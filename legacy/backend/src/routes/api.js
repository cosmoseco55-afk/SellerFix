import { Router } from "express";
import { addTransaction } from "../repositories/dataStore.js";
import { getProfitLeaks } from "../decisionEngine/profitLeaks.js";
import { validateCreateOperation } from "../middleware/validation.js";
import {
  getProfitBySku,
  getSummary,
  getTopLossSku,
  listAlerts,
  listOperations,
  listProducts
} from "../services/dashboardService.js";
import { getUnitEconomicsSnapshot } from "../services/unitEconomicsService.js";

export const apiRouter = Router();

apiRouter.get("/dashboard/summary", (req, res) => {
  const { from = "", to = "" } = req.query;
  const summary = getSummary({ from: String(from || ""), to: String(to || "") });
  const bySku = getProfitBySku({ from: String(from || ""), to: String(to || "") });
  const topLoss = getTopLossSku({ from: String(from || ""), to: String(to || ""), limit: 5 });
  const alerts = listAlerts();
  res.json({ summary, by_sku: bySku, top_loss_sku: topLoss, active_alerts: alerts });
});

apiRouter.get("/products", (_req, res) => {
  res.json(listProducts());
});

apiRouter.get("/operations", (_req, res) => {
  res.json(listOperations());
});

apiRouter.post("/operations", validateCreateOperation, (req, res) => {
  const body = req.body || {};
  const tx = {
    id: body.id || `op-${Date.now()}`,
    date: body.date,
    market: body.market,
    sku: body.sku.trim(),
    revenue: Number(body.revenue || 0),
    marketplace_costs: Number(body.marketplace_costs || 0),
    ads_cost: Number(body.ads_cost || 0),
    cogs: Number(body.cogs || 0)
  };
  const created = addTransaction(tx);
  res.status(201).json(created);
});

apiRouter.get("/unit-economics", (_req, res) => {
  res.json(getUnitEconomicsSnapshot());
});

apiRouter.get("/alerts", (_req, res) => {
  res.json(listAlerts());
});

apiRouter.get("/profit-leaks", (_req, res) => {
  res.json(getProfitLeaks());
});
