import { q } from "../db/pg.js";

export async function enforceUserLimit({ userId, limit = 30, windowSeconds = 60 }) {
  const now = new Date();
  const r = await q("select * from user_rate_limits where user_id=$1", [userId]);

  if (r.rows.length === 0) {
    await q("insert into user_rate_limits(user_id, window_start, count) values($1,$2,1)", [userId, now]);
    return { allowed: true };
  }

  const row = r.rows[0];
  const ws = new Date(row.window_start);
  const diff = (now - ws) / 1000;

  if (diff >= windowSeconds) {
    await q("update user_rate_limits set window_start=$2, count=1 where user_id=$1", [userId, now]);
    return { allowed: true };
  }

  const count = Number(row.count);
  if (count >= limit) return { allowed: false, retryAfter: Math.ceil(windowSeconds - diff) };

  await q("update user_rate_limits set count=count+1 where user_id=$1", [userId]);
  return { allowed: true };
}
