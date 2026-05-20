const markets = new Set(["WB", "Ozon"]);

export function validateCreateOperation(req, _res, next) {
  const body = req.body || {};
  const errors = [];

  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.push("date must be YYYY-MM-DD");
  }
  if (typeof body.market !== "string" || !markets.has(body.market)) {
    errors.push("market must be one of: WB, Ozon");
  }
  if (typeof body.sku !== "string" || !body.sku.trim()) {
    errors.push("sku is required");
  }

  const numericFields = ["revenue", "marketplace_costs", "ads_cost", "cogs"];
  for (const field of numericFields) {
    if (!Number.isFinite(Number(body[field] ?? 0))) {
      errors.push(`${field} must be a finite number`);
    }
  }

  if (errors.length) {
    const error = new Error(`Validation failed: ${errors.join("; ")}`);
    error.status = 400;
    return next(error);
  }

  return next();
}
