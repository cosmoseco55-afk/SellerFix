export const seed = {
  products: [
    { sku: "Органайзер Loft Box", market: "WB", group: "home", sales: 182, revenue: 1248000, costs: 321000 },
    { sku: "Сыворотка Glow C", market: "Ozon", group: "beauty", sales: 96, revenue: 792000, costs: 244000 },
    { sku: "Набор полотенец Soft", market: "WB", group: "home", sales: 134, revenue: 651000, costs: 173000 },
    { sku: "Детский термостакан", market: "Ozon", group: "kids", sales: 77, revenue: 438000, costs: 112000 },
    { sku: "Массажная щетка", market: "WB", group: "beauty", sales: 62, revenue: 302000, costs: 119000 }
  ],
  product_costs: [
    { sku: "Органайзер Loft Box", cogs_per_unit: 793, min_price: 5486, min_margin_pct: 15, max_drr_pct: 15 },
    { sku: "Сыворотка Glow C", cogs_per_unit: 1144, min_price: 6600, min_margin_pct: 15, max_drr_pct: 15 },
    { sku: "Набор полотенец Soft", cogs_per_unit: 581, min_price: 3887, min_margin_pct: 15, max_drr_pct: 15 },
    { sku: "Детский термостакан", cogs_per_unit: 654, min_price: 4551, min_margin_pct: 15, max_drr_pct: 15 },
    { sku: "Массажная щетка", cogs_per_unit: 864, min_price: 3897, min_margin_pct: 15, max_drr_pct: 15 }
  ],
  marketplace_transactions: [
    { id: "op-001", date: "2026-05-01", market: "WB", sku: "Органайзер Loft Box", revenue: 1248000, marketplace_costs: 0, ads_cost: 0, cogs: 0 },
    { id: "op-002", date: "2026-05-01", market: "WB", sku: "Органайзер Loft Box", revenue: 0, marketplace_costs: 143000, ads_cost: 0, cogs: 0 },
    { id: "op-003", date: "2026-05-02", market: "Ozon", sku: "Сыворотка Glow C", revenue: 792000, marketplace_costs: 0, ads_cost: 0, cogs: 0 },
    { id: "op-004", date: "2026-05-02", market: "Ozon", sku: "Сыворотка Glow C", revenue: 0, marketplace_costs: 0, ads_cost: 142000, cogs: 0 },
    { id: "op-005", date: "2026-05-03", market: "WB", sku: "Набор полотенец Soft", revenue: 0, marketplace_costs: 81000, ads_cost: 0, cogs: 0 },
    { id: "op-006", date: "2026-05-04", market: "Ozon", sku: "Детский термостакан", revenue: 214000, marketplace_costs: 0, ads_cost: 0, cogs: 0 }
  ],
  inventory_balances: [
    { sku: "Органайзер Loft Box", location: "WB", quantity: 164, days_cover: 9 },
    { sku: "Сыворотка Glow C", location: "Ozon", quantity: 88, days_cover: 18 },
    { sku: "Набор полотенец Soft", location: "WB", quantity: 57, days_cover: 12 },
    { sku: "Детский термостакан", location: "Ozon", quantity: 124, days_cover: 31 },
    { sku: "Массажная щетка", location: "WB", quantity: 42, days_cover: 20 },
    { sku: "Органайзер Loft Box", location: "OWN", quantity: 26, days_cover: 2 }
  ],
  china_shipments: [
    { id: "cn-001", sku: "Органайзер Loft Box", quantity: 300, eta_date: "2026-05-20", status: "in_transit" }
  ]
};
