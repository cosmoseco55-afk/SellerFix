import fs from "node:fs";
import path from "node:path";
import { seed } from "../data/seed.js";
import { getSqlite } from "./connection.js";

export function initDb() {
  const db = getSqlite();
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);

  const count = db.prepare("SELECT COUNT(*) AS total FROM products").get().total;
  if (count > 0) return;

  const insertProduct = db.prepare(
    "INSERT INTO products (sku, market, product_group, sales, revenue, costs) VALUES (@sku, @market, @group, @sales, @revenue, @costs)"
  );
  const insertCost = db.prepare(
    "INSERT INTO product_costs (sku, cogs_per_unit, min_price, min_margin_pct, max_drr_pct) VALUES (@sku, @cogs_per_unit, @min_price, @min_margin_pct, @max_drr_pct)"
  );
  const insertTx = db.prepare(
    "INSERT INTO marketplace_transactions (id, date, market, sku, revenue, marketplace_costs, ads_cost, cogs) VALUES (@id, @date, @market, @sku, @revenue, @marketplace_costs, @ads_cost, @cogs)"
  );
  const insertInventory = db.prepare(
    "INSERT INTO inventory_balances (sku, location, quantity, days_cover) VALUES (@sku, @location, @quantity, @days_cover)"
  );
  const insertShipment = db.prepare(
    "INSERT INTO china_shipments (id, sku, quantity, eta_date, status) VALUES (@id, @sku, @quantity, @eta_date, @status)"
  );

  const seedTx = db.transaction(() => {
    seed.products.forEach((row) => insertProduct.run(row));
    seed.product_costs.forEach((row) => insertCost.run(row));
    seed.marketplace_transactions.forEach((row) => insertTx.run(row));
    seed.inventory_balances.forEach((row) => insertInventory.run(row));
    seed.china_shipments.forEach((row) => insertShipment.run(row));
  });
  seedTx();
}
