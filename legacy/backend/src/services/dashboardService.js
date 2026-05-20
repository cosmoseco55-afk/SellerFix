import { getProducts, getTransactions } from "../repositories/dataStore.js";
import { buildRulesAlerts, buildSkuDailyMetrics } from "./unitEconomicsService.js";

function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function getSummary({ from = "", to = "" } = {}) {
  const metrics = buildSkuDailyMetrics().filter((row) => inRange(row.date, from, to));
  const revenue = metrics.reduce((sum, row) => sum + row.revenue, 0);
  const profit = metrics.reduce((sum, row) => sum + row.profit, 0);
  const ads_cost = metrics.reduce((sum, row) => sum + row.ads_cost, 0);
  return {
    from: from || null,
    to: to || null,
    revenue,
    profit,
    ads_cost,
    sku_count: new Set(metrics.map((row) => row.sku)).size
  };
}

export function getProfitBySku({ from = "", to = "" } = {}) {
  const grouped = new Map();
  buildSkuDailyMetrics()
    .filter((row) => inRange(row.date, from, to))
    .forEach((row) => {
      const current = grouped.get(row.sku) || { sku: row.sku, market: row.market, revenue: 0, profit: 0 };
      current.revenue += row.revenue;
      current.profit += row.profit;
      grouped.set(row.sku, current);
    });
  return [...grouped.values()].map((row) => ({
    ...row,
    margin_pct: row.revenue ? Math.round((row.profit / row.revenue) * 1000) / 10 : 0
  }));
}

export function getTopLossSku({ from = "", to = "", limit = 5 } = {}) {
  return getProfitBySku({ from, to })
    .sort((a, b) => a.profit - b.profit)
    .slice(0, Math.max(1, Number(limit) || 5));
}

export function listProducts() {
  return getProducts();
}

export function listOperations() {
  return getTransactions();
}

export function listAlerts() {
  return buildRulesAlerts();
}
