import { dbi } from "../db/index.js";
import { embedText, cosineSim } from "./embeddings.js";

export async function ensureUser(userId) {
  await dbi.query("INSERT INTO users(id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [userId])
    .catch(async () => {
      // SQLite fallback (?)
      await dbi.query("INSERT OR IGNORE INTO users(id) VALUES (?)", [userId]);
    });
}

export async function getUserProfile(userId) {
  if (!userId) return {};
  await ensureUser(userId);

  // Postgres
  if (process.env.DATABASE_URL) {
    const r = await dbi.query("SELECT data_json FROM user_profile WHERE user_id=$1", [userId]);
    return r.rows?.[0]?.data_json ? JSON.parse(r.rows[0].data_json) : {};
  }

  // SQLite
  const r = await dbi.query("SELECT data_json FROM user_profile WHERE user_id=?", [userId]);
  return r.rows?.[0]?.data_json ? JSON.parse(r.rows[0].data_json) : {};
}

export async function setUserProfile(userId, profileObj) {
  await ensureUser(userId);
  const json = JSON.stringify(profileObj || {});

  if (process.env.DATABASE_URL) {
    await dbi.query(
      `INSERT INTO user_profile(user_id, data_json, updated_at)
       VALUES($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET data_json=EXCLUDED.data_json, updated_at=NOW()`,
      [userId, json]
    );
    return;
  }

  await dbi.query(
    `INSERT INTO user_profile(user_id, data_json, updated_at)
     VALUES(?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json, updated_at=datetime('now')`,
    [userId, json]
  );
}

export async function addMemory(userId, kind, text, meta = {}) {
  await ensureUser(userId);
  const embedding = await embedText(text);

  const metaJson = JSON.stringify(meta || {});
  const embJson = JSON.stringify(embedding || null);

  if (process.env.DATABASE_URL) {
    await dbi.query(
      `INSERT INTO memories(user_id, kind, text, meta_json, embedding_json)
       VALUES($1, $2, $3, $4, $5)`,
      [userId, kind, text, metaJson, embJson]
    );
    return;
  }

  await dbi.query(
    `INSERT INTO memories(user_id, kind, text, meta_json, embedding_json)
     VALUES(?, ?, ?, ?, ?)`,
    [userId, kind, text, metaJson, embJson]
  );
}

export async function searchMemories(userId, query, limit = 6) {
  await ensureUser(userId);
  const qEmbed = await embedText(query);

  let rows = [];
  if (process.env.DATABASE_URL) {
    const r = await dbi.query(
      `SELECT id, kind, text, meta_json, embedding_json, created_at
       FROM memories
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 300`,
      [userId]
    );
    rows = r.rows || [];
  } else {
    const r = await dbi.query(
      `SELECT id, kind, text, meta_json, embedding_json, created_at
       FROM memories
       WHERE user_id=?
       ORDER BY datetime(created_at) DESC
       LIMIT 300`,
      [userId]
    );
    rows = r.rows || [];
  }

  const scored = rows.map(r => {
    const emb = r.embedding_json ? JSON.parse(r.embedding_json) : null;
    const score = emb ? cosineSim(qEmbed, emb) : 0;
    return {
      id: r.id,
      kind: r.kind,
      text: r.text,
      meta: r.meta_json ? JSON.parse(r.meta_json) : {},
      created_at: r.created_at,
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Number(limit) || 6);
}
