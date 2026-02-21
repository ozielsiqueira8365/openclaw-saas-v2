import cron from "node-cron";
import { dbi } from "../db/index.js";
import { searchMemories } from "../memory/store.js";
import { notifyUser } from "./push.js";

let tasks = [];

export function stopScheduler() {
  for (const t of tasks) t.stop();
  tasks = [];
}

export function startScheduler() {
  stopScheduler();

  (async () => {
    let jobs = [];
    if (process.env.DATABASE_URL) {
      const r = await dbi.query("SELECT * FROM scheduled_jobs WHERE enabled=1", []);
      jobs = r.rows || [];
    } else {
      const r = await dbi.query("SELECT * FROM scheduled_jobs WHERE enabled=1", []);
      jobs = r.rows || [];
    }

    for (const job of jobs) {
      const task = cron.schedule(job.cron, async () => {
        try {
          const payload = job.payload_json ? JSON.parse(job.payload_json) : {};
          const userId = job.user_id;

          if (job.name === "daily_summary") {
            const mem = await searchMemories(userId, "lembretes importantes e tarefas", 5);
            await notifyUser(
              userId,
              "Resumo do dia (OpenClaw)",
              mem.length ? mem.map(m => `• ${m.text}`).join("\n") : "Sem novidades na memória.",
              { type: "daily_summary" }
            );
          }

          if (job.name === "custom_notify") {
            await notifyUser(
              userId,
              payload.title || "OpenClaw",
              payload.body || "Notificação",
              payload.data || {}
            );
          }
        } catch (e) {
          console.error("Scheduler job error:", e);
        }
      });

      tasks.push(task);
    }

    console.log(`✅ Scheduler iniciado com ${tasks.length} job(s).`);
  })().catch(e => console.error("Scheduler init error:", e));
}
