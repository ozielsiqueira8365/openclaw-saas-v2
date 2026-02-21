import pg from "pg";
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada para PostgreSQL.");

  pool = new Pool({
    connectionString: url,
    // Railway geralmente exige SSL; isso evita dor de cabeça
    ssl: { rejectUnauthorized: false }
  });

  return pool;
}

export async function pgQuery(text, params = []) {
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}

export async function pgMigrate() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      locale TEXT DEFAULT 'pt-BR',
      timezone TEXT DEFAULT 'America/Manaus',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memories (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      meta_json TEXT,
      embedding_json TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user_time
      ON memories(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_json TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      payload_json TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
