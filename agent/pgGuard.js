import crypto from "crypto";

function is429(err) {
  const msg = String(err?.message || err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Too Many Requests") ||
    msg.includes("Quota exceeded") ||
    msg.toLowerCase().includes("rate limit")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function generateWithRetry(model, prompt, maxRetries = 3) {
  let attempt = 0;
  let lastErr;

  while (attempt <= maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() ?? "";
      return { ok: true, text };
    } catch (e) {
      lastErr = e;
      if (!is429(e)) break;

      const base = 900 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 400);
      await sleep(base + jitter);
      attempt++;
    }
  }

  return { ok: false, error: lastErr, is429: is429(lastErr) };
}

export async function enforceUserLimit(tasksPool, userId, limit = 30, windowSeconds = 60) {
  const r = await tasksPool.query("select * from user_rate_limits where user_id=$1", [userId]);

  if (r.rowCount === 0) {
    await tasksPool.query(
      "insert into user_rate_limits(user_id, window_start, count) values($1, now(), 1)",
      [userId]
    );
    return { allowed: true };
  }

  const row = r.rows[0];
  const now = new Date();
  const windowStart = new Date(row.window_start);
  const diff = (now - windowStart) / 1000;

  if (diff >= windowSeconds) {
    await tasksPool.query(
      "update user_rate_limits set window_start=now(), count=1 where user_id=$1",
      [userId]
    );
    return { allowed: true };
  }

  const count = Number(row.count || 0);
  if (count >= limit) return { allowed: false, retryAfter: Math.ceil(windowSeconds - diff) };

  await tasksPool.query("update user_rate_limits set count=count+1 where user_id=$1", [userId]);
  return { allowed: true };
}

export function parseToolJson(text) {
  const t = String(text || "").trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  try {
    const obj = JSON.parse(t);
    if (obj?.tool && obj?.args) return obj;
    return null;
  } catch {
    return null;
  }
}

export async function runTaskTool(tasksPool, tool, args) {
  if (tool === "create_task") {
    const title = String(args?.title || "").trim();
    if (!title) return { ok: false, error: "title obrigatório" };

    const description = args?.description ? String(args.description) : null;
    const taskType = String(args?.task_type || "manual");
    const payload = args?.payload ? args.payload : {};

    const id = crypto.randomUUID();

    // tabela tasks do seu worker (queued/running/done/error + run_at + attempts + etc.)
    await tasksPool.query(
      `insert into tasks (id, title, description, task_type, payload, status, run_at, attempts, max_attempts, priority)
       values ($1,$2,$3,$4,$5::jsonb,'queued', now(), 0, 6, 50)`,
      [id, title, description, taskType, JSON.stringify(payload)]
    );

    return { ok: true, result: { id, title, description, task_type: taskType } };
  }

  if (tool === "list_tasks") {
    const limit = Math.min(Number(args?.limit || 30), 200);
    const r = await tasksPool.query(
      "select id, title, description, task_type, status, created_at from tasks order by created_at desc limit $1",
      [limit]
    );
    return { ok: true, result: r.rows };
  }

  if (tool === "complete_task") {
    const id = String(args?.id || "");
    if (!id) return { ok: false, error: "id obrigatório" };

    // Se sua tabela tiver status, marca done. Se não tiver, isso falharia — mas pelo seu worker tem.
    const r = await tasksPool.query(
      "update tasks set status='done' where id=$1 returning id, status",
      [id]
    );
    if (!r.rowCount) return { ok: false, error: "task não encontrada" };
    return { ok: true, result: r.rows[0] };
  }

  return { ok: false, error: "tool desconhecida" };
}
