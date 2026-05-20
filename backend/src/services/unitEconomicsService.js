import {
  getChinaShipments,
  getInventoryBalances,
  getProductCosts,
  getProducts,
  getTransactions
} from "../repositories/dataStore.js";

export function calculateProfit(row) {
  return row.revenue - row.marketplace_costs - row.ads_cost - row.cogs;
}

export function buildSkuDailyMetrics() {
  const byKey = new Map();
  const txs = getTransactions();
  txs.forEach((tx) => {
    const key = `${tx.date}::${tx.sku}`;
    const current = byKey.get(key) || {
      date: tx.date,
      sku: tx.sku,
      market: tx.market,
      revenue: 0,
      marketplace_costs: 0,
      ads_cost: 0,
      cogs: 0
    };
    current.revenue += tx.revenue;
    current.marketplace_costs += tx.marketplace_costs;
    current.ads_cost += tx.ads_cost;
    current.cogs += tx.cogs;
    byKey.set(key, current);
  });

  return [...byKey.values()].map((row) => {
    const profit = calculateProfit(row);
    const margin_pct = row.revenue ? (profit / row.revenue) * 100 : 0;
    const drr_pct = row.revenue ? (row.ads_cost / row.revenue) * 100 : 0;
    return {
      ...row,
      profit,
      margin_pct: Math.round(margin_pct * 10) / 10,
      drr_pct: Math.round(drr_pct * 10) / 10
    };
  });
}

export function buildRulesAlerts() {
  const metrics = buildSkuDailyMetrics();
  const costs = new Map(getProductCosts().map((row) => [row.sku, row]));
  const products = new Map(getProducts().map((row) => [row.sku, row]));
  const stockBySku = new Map(getInventoryBalances().map((row) => [row.sku, row]));
  const alerts = [];

  const skuRollup = new Map();
  metrics.forEach((row) => {
    const current = skuRollup.get(row.sku) || {
      sku: row.sku,
      market: row.market,
      revenue: 0,
      marketplace_costs: 0,
      ads_cost: 0,
      cogs: 0,
      profit: 0
    };
    current.revenue += row.revenue;
    current.marketplace_costs += row.marketplace_costs;
    current.ads_cost += row.ads_cost;
    current.cogs += row.cogs;
    current.profit += row.profit;
    skuRollup.set(row.sku, current);
  });

  for (const item of skuRollup.values()) {
    const cfg = costs.get(item.sku) || { min_margin_pct: 15, max_drr_pct: 15, min_price: 0 };
    const product = products.get(item.sku);
    const avgPrice = product && product.sales ? product.revenue / product.sales : 0;
    const margin = item.revenue ? (item.profit / item.revenue) * 100 : 0;
    const drr = item.revenue ? (item.ads_cost / item.revenue) * 100 : 0;
    const stock = stockBySku.get(item.sku);

    if (item.profit < 0) alerts.push(rule("SKU в минусе", item, "high", item.profit));
    if (margin < cfg.min_margin_pct) alerts.push(rule("маржа ниже нормы", item, "medium", margin));
    if (avgPrice > 0 && cfg.min_price > 0 && avgPrice < cfg.min_price) alerts.push(rule("цена ниже минимальной", item, "high", avgPrice));
    if (drr > cfg.max_drr_pct) alerts.push(rule("высокий ДРР", item, "medium", drr));
    if (stock && stock.days_cover <= 12) alerts.push(rule("риск out-of-stock", item, "high", stock.days_cover));
  }

  // add shipment context for future expansion
  const shipments = getChinaShipments().filter((row) => row.status === "in_transit");
  if (!shipments.length) return alerts;
  return alerts;
}

function rule(rule_type, item, severity, value) {
  return {
    id: `${rule_type}:${item.sku}`,
    rule_type,
    sku: item.sku,
    market: item.market,
    severity,
    value: Math.round(value * 10) / 10,
    is_active: true
  };
}

export function getUnitEconomicsSnapshot() {
  return {
    products: getProducts(),
    product_costs: getProductCosts(),
    marketplace_transactions: getTransactions(),
    sku_daily_metrics: buildSkuDailyMetrics(),
    alerts: buildRulesAlerts()
  };
}
