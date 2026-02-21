import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined
});

export async function hitRateLimit({ key, limit, windowSeconds }) {
  const r = await pool.query(
    `
    insert into rate_limits(key, window_start, count)
    values($1, date_trunc('second', now()), 1)
    on conflict (key) do update
    set
      window_start = case
        when rate_limits.window_start < (now() - ($2 || ' seconds')::interval)
        then date_trunc('second', now())
        else rate_limits.window_start
      end,
      count = case
        when rate_limits.window_start < (now() - ($2 || ' seconds')::interval)
        then 1
        else rate_limits.count + 1
      end
    returning window_start, count
    `,
    [key, windowSeconds]
  );

  const { window_start, count } = r.rows[0];
  const resetAt = new Date(new Date(window_start).getTime() + windowSeconds * 1000);

  return { allowed: count <= limit, count, limit, resetAt };
}