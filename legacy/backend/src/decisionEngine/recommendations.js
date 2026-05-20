export function recommendationForLoss(drrPct, maxDrrPct) {
  if (drrPct > maxDrrPct) return "Отключить или снизить рекламу";
  return "Поднять цену или проверить себестоимость";
}

export function recommendationForLeak(type) {
  if (type === "low_margin") return "Пересчитать цену и проверить комиссии/логистику";
  if (type === "high_ads") return "Снизить ставку, бюджет или отключить неэффективную кампанию";
  if (type === "high_marketplace_costs") return "Проверить комиссию, логистику, хранение и категорию товара";
  if (type === "opportunity") return "Можно масштабировать рекламу или увеличить поставку";
  return "Проверить экономику SKU";
}
