import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Database } from "bun:sqlite";

let _db: Database | null = null;

/** Default app id until multi-app is modeled. */
export const DEFAULT_APP_ID = 1;

export function getDb(): Database {
  if (_db) return _db;
  const dbPath = path.join(process.cwd(), "data", "analytics.db");
  _db = new Database(dbPath, { create: true });
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA synchronous = NORMAL;");
  _db.exec("PRAGMA foreign_keys = ON;");
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  _db.exec(readFileSync(schemaPath, "utf8"));
  return _db;
}
