import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on("error", (err) => {
  console.error("💥 PG pool error:", err?.message || err);
});

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(Object.assign(new Error(label), { status: 504 })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export async function pgQuery(text, params = []) {
  // 10s por query pra nunca “pendurar”
  return withTimeout(pool.query(text, params), 10000, "pg_query_timeout");
}