import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : undefined
  });

  await c.connect();
  console.log("✅ conectado");

  await c.query("BEGIN");
  try {
    await c.query("DROP TABLE IF EXISTS messages CASCADE;");
    await c.query("DROP TABLE IF EXISTS sessions CASCADE;");
    await c.query("COMMIT");
    console.log("✅ drop sessions/messages feito");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("❌ reset falhou:", e?.message || e);
  process.exit(1);
});