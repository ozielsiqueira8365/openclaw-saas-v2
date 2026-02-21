import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não definido no .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL.includes("rlwy.net") ||
    process.env.DATABASE_URL.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "..", "..", "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function hasMigration(id) {
  const r = await pool.query(`select 1 from schema_migrations where id = $1 limit 1`, [id]);
  return r.rowCount > 0;
}

async function applyMigration(id, sql) {
  await pool.query("begin");
  try {
    await pool.query(sql);
    await pool.query(`insert into schema_migrations(id) values($1)`, [id]);
    await pool.query("commit");
    console.log(`✅ Applied migration: ${id}`);
  } catch (e) {
    await pool.query("rollback");
    console.error(`❌ Migration failed: ${id}`);
    throw e;
  }
}

async function main() {
  await ensureMigrationsTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("❌ Nenhuma migration .sql encontrada em /migrations");
    process.exit(1);
  }

  for (const file of files) {
    if (await hasMigration(file)) {
      console.log(`↪️  Skipped (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await applyMigration(file, sql);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
