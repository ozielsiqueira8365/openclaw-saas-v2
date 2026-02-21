import { q } from "../db/pg.js";

export async function runTool({ conversationId, tool, args }) {
  if (tool === "create_task") {
    const title = String(args?.title || "").trim();
    if (!title) return { ok: false, error: "title obrigatório" };

    const description = args?.description ? String(args.description) : null;
    const dueAt = args?.due_at ? new Date(args.due_at) : null;

    const r = await q(
      `insert into tasks(conversation_id, title, description, status, due_at)
       values($1,$2,$3,'open',$4)
       returning id,title,description,status,due_at,created_at`,
      [conversationId, title, description, dueAt]
    );
    return { ok: true, result: r.rows[0] };
  }

  if (tool === "list_tasks") {
    const status = args?.status ? String(args.status) : null;
    const r = await q(
      `select id,title,description,status,due_at,created_at
       from tasks
       where conversation_id=$1
       ${status ? "and status=$2" : ""}
       order by created_at desc
       limit 50`,
      status ? [conversationId, status] : [conversationId]
    );
    return { ok: true, result: r.rows };
  }

  if (tool === "complete_task") {
    const id = Number(args?.id);
    if (!id) return { ok: false, error: "id inválido" };

    const r = await q(
      `update tasks set status='done', updated_at=now()
       where conversation_id=$1 and id=$2
       returning id,title,status,updated_at`,
      [conversationId, id]
    );
    if (!r.rows[0]) return { ok: false, error: "task não encontrada" };
    return { ok: true, result: r.rows[0] };
  }

  return { ok: false, error: "tool desconhecida" };
}
