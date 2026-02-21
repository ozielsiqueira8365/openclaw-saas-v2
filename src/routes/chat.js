import express from "express";
import crypto from "crypto";
import { z } from "zod";

import { pgQuery } from "../db/pg.js";
import { callLLM } from "../../llm/llmClient.js";

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function parseBearer(req) {
  const h = req.headers.authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function parseApiKey(full) {
  // formato: oc_live_PREFIX.SECRET
  const s = String(full || "").trim();
  const [prefix, secret] = s.split(".");
  if (!prefix || !secret) return null;
  if (!prefix.startsWith("oc_live_") && !prefix.startsWith("oc_test_")) return null;
  return { prefix, secret };
}

function planToLimit(plan) {
  const p = String(plan || "free").toLowerCase();
  if (p === "pro") return Number(process.env.CHAT_PER_MIN_PRO || 60);
  if (p === "team") return Number(process.env.CHAT_PER_MIN_TEAM || 180);
  if (p === "enterprise") return Number(process.env.CHAT_PER_MIN_ENTERPRISE || 600);
  return Number(process.env.CHAT_PER_MIN_FREE || 20);
}

async function requireApiKey(req, res, next) {
  try {
    const full = parseBearer(req);
    const parsed = parseApiKey(full);
    if (!parsed) return res.status(401).json({ ok: false, error: "missing_or_invalid_api_key" });

    const keyHash = sha256(parsed.secret);

    const r = await pgQuery(
      `
      select
        ak.id as api_key_id,
        ak.workspace_id,
        w.plan
      from api_keys ak
      join workspaces w on w.id = ak.workspace_id
      where ak.prefix = $1
        and ak.key_hash = $2
        and ak.revoked_at is null
      limit 1
      `,
      [parsed.prefix, keyHash]
    );

    if (!r.rowCount) return res.status(401).json({ ok: false, error: "missing_or_invalid_api_key" });

    req.auth = {
      workspace_id: r.rows[0].workspace_id,
      plan: r.rows[0].plan || "free",
      api_key_id: r.rows[0].api_key_id
    };

    next();
  } catch (e) {
    console.error("❌ requireApiKey error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "auth_error" });
  }
}

// Rate-limit simples por workspace/minuto (em memória do processo)
// (Depois você troca por rate-limit em PG se quiser)
const rlMem = new Map();
function rateLimitMem(workspaceId, plan) {
  const limit = planToLimit(plan);
  const now = Date.now();
  const windowMs = 60_000;
  const key = String(workspaceId);

  const cur = rlMem.get(key) || { start: now, count: 0 };
  if (now - cur.start >= windowMs) {
    cur.start = now;
    cur.count = 0;
  }
  cur.count += 1;
  rlMem.set(key, cur);

  if (cur.count > limit) {
    const retryAfter = Math.ceil((windowMs - (now - cur.start)) / 1000);
    return { allowed: false, retryAfter, limit };
  }
  return { allowed: true, retryAfter: 0, limit };
}

export default function chatRouter() {
  const router = express.Router();

  router.post("/v1/chat", requireApiKey, async (req, res) => {
    // ✅ timeout de rota: nunca fica “pendurado”
    res.setTimeout(28_000, () => {
      try {
        return res.status(504).json({ ok: false, error: "route_timeout" });
      } catch {}
    });

    const schema = z.object({
      message: z.string().min(1),
      mode: z.string().optional(),
      session_id: z.string().uuid().optional()
    });

    const started = Date.now();

    try {
      const body = schema.parse(req.body || {});
      const { workspace_id, plan } = req.auth;

      // rate limit
      const lim = rateLimitMem(workspace_id, plan);
      if (!lim.allowed) {
        return res.status(429).json({
          ok: false,
          error: "rate_limited",
          retryAfter: lim.retryAfter,
          limitPerMin: lim.limit,
          plan
        });
      }

      const sessionId = body.session_id || crypto.randomUUID();
      const mode = String(body.mode || "geral").toLowerCase();
      const userMsg = String(body.message).trim();

      // garante sessão
      await pgQuery(
        `
        insert into sessions (id, workspace_id, mode, created_at)
        values ($1, $2, $3, now())
        on conflict (id) do nothing
        `,
        [sessionId, workspace_id, mode]
      );

      // salva msg do user
      await pgQuery(
        `
        insert into messages (id, session_id, role, content, created_at)
        values ($1, $2, 'user', $3, now())
        `,
        [crypto.randomUUID(), sessionId, userMsg]
      );

      // pega ultimas mensagens (contexto curto)
      const hist = await pgQuery(
        `
        select role, content
        from messages
        where session_id = $1
        order by created_at asc
        limit 12
        `,
        [sessionId]
      );

      const system = `Você é o OpenClaw SaaS v2. Responda em pt-BR. Modo: ${mode}. Seja objetivo.`;
      const messages = (hist.rows || []).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const replyText = await callLLM({
        system,
        messages,
        temperature: 0.3,
        max_tokens: 300
      });

      const reply = String(replyText || "").trim() || "(sem resposta do modelo)";

      // salva resposta
      await pgQuery(
        `
        insert into messages (id, session_id, role, content, created_at)
        values ($1, $2, 'assistant', $3, now())
        `,
        [crypto.randomUUID(), sessionId, reply]
      );

      return res.json({
        ok: true,
        session_id: sessionId,
        reply,
        meta: {
          plan,
          ms: Date.now() - started
        }
      });
    } catch (e) {
      const status = e?.status || 500;
      const msg = String(e?.message || e);
      console.error("❌ /v1/chat error:", status, msg);
      return res.status(status).json({ ok: false, error: "chat_failed", detail: msg });
    }
  });

  // histórico
  router.get("/v1/sessions/:id/messages", requireApiKey, async (req, res) => {
    try {
      const sessionId = String(req.params.id || "");
      const { workspace_id } = req.auth;

      // garante que a sessão é do workspace
      const s = await pgQuery(`select id from sessions where id=$1 and workspace_id=$2 limit 1`, [
        sessionId,
        workspace_id
      ]);
      if (!s.rowCount) return res.status(404).json({ ok: false, error: "session_not_found" });

      const r = await pgQuery(
        `
        select role, content, created_at
        from messages
        where session_id = $1
        order by created_at asc
        limit 200
        `,
        [sessionId]
      );

      return res.json({ ok: true, session_id: sessionId, messages: r.rows });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "history_failed" });
    }
  });

  return router;
}