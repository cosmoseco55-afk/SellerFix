-- MVP schema (SQLite/PostgreSQL compatible baseline)
CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  product_group TEXT NOT NULL,
  sales REAL NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  costs REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_costs (
  sku TEXT PRIMARY KEY,
  cogs_per_unit REAL NOT NULL,
  min_price REAL NOT NULL,
  min_margin_pct REAL NOT NULL,
  max_drr_pct REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  market TEXT NOT NULL,
  sku TEXT NOT NULL,
  revenue REAL NOT NULL DEFAULT 0,
  marketplace_costs REAL NOT NULL DEFAULT 0,
  ads_cost REAL NOT NULL DEFAULT 0,
  cogs REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sku_daily_metrics (
  date TEXT NOT NULL,
  sku TEXT NOT NULL,
  market TEXT NOT NULL,
  revenue REAL NOT NULL DEFAULT 0,
  marketplace_costs REAL NOT NULL DEFAULT 0,
  ads_cost REAL NOT NULL DEFAULT 0,
  cogs REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  margin_pct REAL NOT NULL DEFAULT 0,
  drr_pct REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date, sku)
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  sku TEXT NOT NULL,
  market TEXT NOT NULL,
  severity TEXT NOT NULL,
  value REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  days_cover REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (sku, location)
);

CREATE TABLE IF NOT EXISTS china_shipments (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  eta_date TEXT NOT NULL,
  status TEXT NOT NULL
);
