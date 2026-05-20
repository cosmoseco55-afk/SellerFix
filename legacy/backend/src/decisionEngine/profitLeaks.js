import { getProductCosts } from "../repositories/dataStore.js";
import { buildSkuDailyMetrics } from "../services/unitEconomicsService.js";
import { recommendationForLeak, recommendationForLoss } from "./recommendations.js";

const severityOrder = {
  critical: 0,
  warning: 1,
  opportunity: 2
};

function toBaseLeak(item, reason, recommendedAction, severity, lossAmount) {
  return {
    sku: item.sku,
    market: item.market,
    loss_amount: Math.round(lossAmount * 10) / 10,
    reason,
    recommended_action: recommendedAction,
    severity,
    metrics: {
      revenue: item.revenue,
      profit: item.profit,
      margin_pct: Math.round(item.margin_pct * 10) / 10,
      drr_pct: Math.round(item.drr_pct * 10) / 10,
      ads_cost: item.ads_cost,
      marketplace_costs: item.marketplace_costs,
      cogs: item.cogs
    }
  };
}

export function getProfitLeaks() {
  const costsMap = new Map(getProductCosts().map((row) => [row.sku, row]));
  const bySku = new Map();
  const metrics = buildSkuDailyMetrics();

  metrics.forEach((row) => {
    const current = bySku.get(row.sku) || {
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
    bySku.set(row.sku, current);
  });

  const leaks = [];
  for (const item of bySku.values()) {
    const cfg = costsMap.get(item.sku) || { min_margin_pct: 15, max_drr_pct: 15 };
    const marginPct = item.revenue ? (item.profit / item.revenue) * 100 : 0;
    const drrPct = item.revenue ? (item.ads_cost / item.revenue) * 100 : 0;
    const marketplaceCostPct = item.revenue ? item.marketplace_costs / item.revenue : 0;
    const normalized = { ...item, margin_pct: marginPct, drr_pct: drrPct };

    // A. SKU sells at a loss
    if (item.profit < 0) {
      leaks.push(
        toBaseLeak(
          normalized,
          "SKU продаётся в минус",
          recommendationForLoss(drrPct, cfg.max_drr_pct),
          "critical",
          Math.abs(item.profit)
        )
      );
    }

    // B. Low margin
    if (marginPct < cfg.min_margin_pct) {
      const shortfall = item.revenue * Math.max(0, (cfg.min_margin_pct - marginPct) / 100);
      leaks.push(
        toBaseLeak(normalized, "Маржа ниже нормы", recommendationForLeak("low_margin"), "warning", shortfall)
      );
    }

    // C. High ads spend
    if (drrPct > cfg.max_drr_pct) {
      const overspend = item.revenue * Math.max(0, (drrPct - cfg.max_drr_pct) / 100);
      leaks.push(
        toBaseLeak(normalized, "Высокий ДРР", recommendationForLeak("high_ads"), "warning", overspend)
      );
    }

    // D. High marketplace costs
    if (marketplaceCostPct > 0.35) {
      const extraMarketplaceCosts = item.revenue * (marketplaceCostPct - 0.35);
      leaks.push(
        toBaseLeak(
          normalized,
          "Высокие расходы маркетплейса",
          recommendationForLeak("high_marketplace_costs"),
          "warning",
          extraMarketplaceCosts
        )
      );
    }

    // E. Good opportunity
    if (item.profit > 0 && marginPct > cfg.min_margin_pct && drrPct < cfg.max_drr_pct) {
      leaks.push(
        toBaseLeak(normalized, "Здоровая экономика SKU", recommendationForLeak("opportunity"), "opportunity", item.profit)
      );
    }
  }

  return leaks.sort((a, b) => {
    const sevCompare = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevCompare !== 0) return sevCompare;
    return Math.abs(b.loss_amount) - Math.abs(a.loss_amount);
  });
}
