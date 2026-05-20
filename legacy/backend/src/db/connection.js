import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let sqlite;

export function getDbConfig() {
  return {
    client: process.env.DB_CLIENT || "sqlite",
    url: process.env.DB_URL || "./data/sellerfix.sqlite"
  };
}

export function getSqlite() {
  if (sqlite) return sqlite;
  const config = getDbConfig();
  if (config.client !== "sqlite") {
    throw new Error("Only sqlite runtime is enabled in this MVP backend.");
  }
  const dbPath = path.resolve(process.cwd(), config.url);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}
