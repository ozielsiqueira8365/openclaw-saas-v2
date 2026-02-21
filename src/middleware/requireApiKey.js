import pg from "pg";
import dotenv from "dotenv";
import { splitKey, hashSecret } from "../utils/apiKey.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined
});

export function requireApiKey() {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

      const parsed = splitKey(token);
      if (!parsed) return res.status(401).json({ ok: false, error: "missing_or_invalid_api_key" });

      const { prefix, secret } = parsed;
      const secretHash = hashSecret(secret);

      const r = await pool.query(
        `
        select
          ak.id as api_key_id,
          ak.workspace_id,
          ak.revoked_at,
          w.plan,
          w.is_active
        from api_keys ak
        join workspaces w on w.id = ak.workspace_id
        where ak.prefix = $1 and ak.key_hash = $2
        limit 1
        `,
        [prefix, secretHash]
      );

      if (r.rowCount === 0) return res.status(401).json({ ok: false, error: "invalid_api_key" });

      const row = r.rows[0];
      if (!row.is_active) return res.status(403).json({ ok: false, error: "workspace_disabled" });
      if (row.revoked_at) return res.status(403).json({ ok: false, error: "api_key_revoked" });

      pool.query(`update api_keys set last_used_at = now() where id = $1`, [row.api_key_id]).catch(() => {});

      req.tenant = {
        workspaceId: row.workspace_id,
        plan: row.plan,
        apiKeyId: row.api_key_id
      };

      next();
    } catch (e) {
      return res.status(500).json({ ok: false, error: "auth_error" });
    }
  };
}