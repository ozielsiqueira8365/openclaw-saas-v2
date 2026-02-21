import express from "express";
import { z } from "zod";
import pg from "pg";
import dotenv from "dotenv";
import { generateSecret, buildFullKey, splitKey, hashSecret, last4 } from "../utils/apiKey.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined
});

export function adminRouter() {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    const token = req.headers["x-admin-token"];
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ ok: false, error: "admin_forbidden" });
    }
    next();
  }

  router.post("/admin/bootstrap", requireAdmin, async (req, res) => {
    const schema = z.object({
      user: z.object({ email: z.string().email(), name: z.string().optional() }),
      workspace: z.object({
        name: z.string().min(2),
        plan: z.enum(["free", "pro", "team", "enterprise"]).optional()
      }),
      api_key_name: z.string().optional()
    });

    const body = schema.parse(req.body);

    const secret = generateSecret();
    const fullKey = buildFullKey(secret);
    const parsed = splitKey(fullKey);

    await pool.query("begin");
    try {
      // ✅ Garante colunas mínimas (para bancos antigos com schema diferente)
      await pool.query(`alter table users add column if not exists email text`);
      await pool.query(`alter table users add column if not exists name text`);
      await pool.query(`alter table users add column if not exists is_active boolean`);
      await pool.query(`alter table users add column if not exists created_at timestamptz`);

      // defaults seguros
      await pool.query(`update users set is_active = true where is_active is null`);
      await pool.query(`update users set created_at = now() where created_at is null`);

      // ✅ Upsert manual (não depende de UNIQUE(email))
      const existingUser = await pool.query(`select id, email, name from users where email = $1 limit 1`, [
        body.user.email
      ]);

      let userRow;

      if (existingUser.rowCount > 0) {
        const u = await pool.query(`update users set name = $2 where id = $1 returning id, email, name`, [
          existingUser.rows[0].id,
          body.user.name || existingUser.rows[0].name || null
        ]);
        userRow = u.rows[0];
      } else {
        const u = await pool.query(
          `insert into users(id, email, name, is_active, created_at)
           values(gen_random_uuid()::text, $1, $2, true, now())
           returning id, email, name`,
          [body.user.email, body.user.name || null]
        );
        userRow = u.rows[0];
      }

      const wsR = await pool.query(`insert into workspaces(name, plan) values($1, $2) returning id, name, plan`, [
        body.workspace.name,
        body.workspace.plan || "free"
      ]);

      await pool.query(
        `
        insert into workspace_members(workspace_id, user_id, role)
        values($1, $2, 'owner')
        on conflict (workspace_id, user_id) do nothing
        `,
        [wsR.rows[0].id, userRow.id]
      );

      const keyR = await pool.query(
        `
        insert into api_keys(workspace_id, name, prefix, key_hash, last4)
        values($1, $2, $3, $4, $5)
        returning id, workspace_id, name, prefix, last4, created_at
        `,
        [wsR.rows[0].id, body.api_key_name || "default", parsed.prefix, hashSecret(parsed.secret), last4(parsed.secret)]
      );

      await pool.query("commit");

      return res.json({
        ok: true,
        user: userRow,
        workspace: wsR.rows[0],
        api_key: keyR.rows[0],
        full_key: fullKey
      });
    } catch (e) {
      await pool.query("rollback");
      console.error("BOOTSTRAP_ERROR:", e);
      return res.status(500).json({
        ok: false,
        error: "bootstrap_failed",
        detail: process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined
      });
    }
  });

  router.post("/admin/workspaces/:id/api-keys", requireAdmin, async (req, res) => {
    const wsId = req.params.id;
    const schema = z.object({ name: z.string().optional() });
    const body = schema.parse(req.body || {});

    const secret = generateSecret();
    const fullKey = buildFullKey(secret);
    const parsed = splitKey(fullKey);

    try {
      const r = await pool.query(
        `
        insert into api_keys(workspace_id, name, prefix, key_hash, last4)
        values($1, $2, $3, $4, $5)
        returning id, workspace_id, name, prefix, last4, created_at
        `,
        [wsId, body.name || "default", parsed.prefix, hashSecret(parsed.secret), last4(parsed.secret)]
      );

      return res.json({ ok: true, api_key: r.rows[0], full_key: fullKey });
    } catch (e) {
      console.error("CREATE_KEY_ERROR:", e);
      return res.status(500).json({
        ok: false,
        error: "create_key_failed",
        detail: process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined
      });
    }
  });

  router.post("/admin/api-keys/:id/revoke", requireAdmin, async (req, res) => {
    const id = req.params.id;
    try {
      await pool.query(`update api_keys set revoked_at = now() where id = $1 and revoked_at is null`, [id]);
      return res.json({ ok: true });
    } catch (e) {
      console.error("REVOKE_KEY_ERROR:", e);
      return res.status(500).json({
        ok: false,
        error: "revoke_failed",
        detail: process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined
      });
    }
  });

  return router;
}