import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não configurada");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres normalmente precisa SSL; se quebrar local, set PGSSL=false
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

// log básico de erros do pool
pool.on("error", (err) => {
  console.error("🔥 Postgres pool error:", err);
});