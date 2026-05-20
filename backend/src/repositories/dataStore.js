import { getSqlite } from "../db/connection.js";

export function getProducts() {
  const db = getSqlite();
  return db.prepare("SELECT sku, market, product_group AS `group`, sales, revenue, costs FROM products").all();
}

export function getProductCosts() {
  const db = getSqlite();
  return db.prepare("SELECT sku, cogs_per_unit, min_price, min_margin_pct, max_drr_pct FROM product_costs").all();
}

export function getTransactions() {
  const db = getSqlite();
  return db.prepare("SELECT id, date, market, sku, revenue, marketplace_costs, ads_cost, cogs FROM marketplace_transactions").all();
}

export function addTransaction(tx) {
  const db = getSqlite();
  db.prepare(
    "INSERT INTO marketplace_transactions (id, date, market, sku, revenue, marketplace_costs, ads_cost, cogs) VALUES (@id, @date, @market, @sku, @revenue, @marketplace_costs, @ads_cost, @cogs)"
  ).run(tx);
  return tx;
}

export function getInventoryBalances() {
  const db = getSqlite();
  return db.prepare("SELECT sku, location, quantity, days_cover FROM inventory_balances").all();
}

export function getChinaShipments() {
  const db = getSqlite();
  return db.prepare("SELECT id, sku, quantity, eta_date, status FROM china_shipments").all();
}
