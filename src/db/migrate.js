import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const MIGRATION_TIMEOUT_MS = 30_000;

const killTimer = setTimeout(() => {
  console.error("[migrate] timeout — abortando");
  process.exit(1);
}, MIGRATION_TIMEOUT_MS);

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyRan(id) {
  const r = await pool.query(`SELECT 1 FROM schema_migrations WHERE id=$1`, [id]);
  return r.rowCount > 0;
}

async function markRan(id) {
  await pool.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
}

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.join(__dirname, "..", "migrations");

  await ensureTable();

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const id = file;
    if (await alreadyRan(id)) {
      console.log(`↪️  Skipped (already applied): ${file}`);
      continue;
    }

    console.log(`[migrate] running: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await markRan(id);
      await pool.query("COMMIT");
      console.log(`[migrate] done: ${file}`);
    } catch (e) {
      await pool.query("ROLLBACK");
      console.error(`[migrate] failed: ${file}`, e?.message || e);
      process.exit(1);
    }
  }

  console.log("[migrate] all done");
  process.exit(0);
}

run()
  .catch((e) => {
    console.error("[migrate] fatal:", e?.message || e);
    process.exit(1);
  })
  .finally(() => clearTimeout(killTimer));