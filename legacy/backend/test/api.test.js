import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { initDb } from "../src/db/init.js";
import { createApp } from "../src/app.js";

process.env.DB_CLIENT = "sqlite";
process.env.DB_URL = "./data/test-sellerfix.sqlite";

initDb();
const app = createApp();

test("GET /health returns ok", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test("GET /api/products returns list", async () => {
  const response = await request(app).get("/api/products");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length > 0);
});

test("POST /api/operations validates input", async () => {
  const response = await request(app).post("/api/operations").send({
    date: "bad-date",
    market: "WBX",
    sku: "",
    revenue: "NaN"
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /Validation failed/);
});

test("POST /api/operations creates operation", async () => {
  const payload = {
    date: "2026-05-10",
    market: "WB",
    sku: "Test SKU",
    revenue: 1000,
    marketplace_costs: 100,
    ads_cost: 50,
    cogs: 300
  };
  const response = await request(app).post("/api/operations").send(payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.sku, "Test SKU");
  assert.equal(response.body.market, "WB");
});

test("GET unknown route returns structured error", async () => {
  const response = await request(app).get("/api/nope");
  assert.equal(response.status, 404);
  assert.equal(response.body.error.status, 404);
});

test("profit < 0 returns critical leak", async () => {
  const sku = `Loss SKU ${Date.now()}`;
  await request(app).post("/api/operations").send({
    date: "2026-05-11",
    market: "WB",
    sku,
    revenue: 100,
    marketplace_costs: 20,
    ads_cost: 120,
    cogs: 10
  });
  const response = await request(app).get("/api/profit-leaks");
  assert.equal(response.status, 200);
  const leak = response.body.find((row) => row.sku === sku && row.severity === "critical");
  assert.ok(leak);
});

test("high drr returns warning", async () => {
  const sku = `High DRR SKU ${Date.now()}`;
  await request(app).post("/api/operations").send({
    date: "2026-05-12",
    market: "WB",
    sku,
    revenue: 1000,
    marketplace_costs: 100,
    ads_cost: 300,
    cogs: 100
  });
  const response = await request(app).get("/api/profit-leaks");
  const leak = response.body.find((row) => row.sku === sku && row.reason === "Высокий ДРР" && row.severity === "warning");
  assert.ok(leak);
});

test("high marketplace costs returns warning", async () => {
  const sku = `High MP Cost SKU ${Date.now()}`;
  await request(app).post("/api/operations").send({
    date: "2026-05-13",
    market: "Ozon",
    sku,
    revenue: 1000,
    marketplace_costs: 500,
    ads_cost: 10,
    cogs: 100
  });
  const response = await request(app).get("/api/profit-leaks");
  const leak = response.body.find(
    (row) => row.sku === sku && row.reason === "Высокие расходы маркетплейса" && row.severity === "warning"
  );
  assert.ok(leak);
});

test("healthy SKU returns opportunity", async () => {
  const sku = `Healthy SKU ${Date.now()}`;
  await request(app).post("/api/operations").send({
    date: "2026-05-14",
    market: "WB",
    sku,
    revenue: 1000,
    marketplace_costs: 100,
    ads_cost: 50,
    cogs: 100
  });
  const response = await request(app).get("/api/profit-leaks");
  const leak = response.body.find((row) => row.sku === sku && row.severity === "opportunity");
  assert.ok(leak);
});
