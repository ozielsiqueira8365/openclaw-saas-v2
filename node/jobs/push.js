import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// PG pool (SaaS v2 é Postgres)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_URL?.includes("rlwy.net") || process.env.DATABASE_URL?.includes("railway")
          ? { rejectUnauthorized: false }
          : undefined
    })
  : null;

let _webpush = null;

async function getWebPush() {
  if (_webpush) return _webpush;

  // Só tenta carregar se VAPID estiver configurado
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;

  try {
    const mod = await import("web-push"); // ✅ import dinâmico (não quebra se não instalado)
    _webpush = mod.default || mod;

    const subj = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    _webpush.setVapidDetails(subj, pub, priv);

    return _webpush;
  } catch (e) {
    console.warn("⚠️ WebPush indisponível (instale `web-push` ou configure VAPID):", e?.message || e);
    return null;
  }
}

export async function initWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;

  if (!pub || !priv) {
    console.warn("⚠️ VAPID keys não configuradas. Push desativado.");
    return;
  }

  const wp = await getWebPush();
  if (wp) console.log("✅ WebPush pronto (VAPID configurado).");
}

export async function notifyUser(userId, title, body, data = {}) {
  if (!pool) return; // sem DATABASE_URL, não faz nada

  const wp = await getWebPush();
  if (!wp) return; // sem VAPID ou sem pacote, não faz nada

  const payload = JSON.stringify({ title, body, data });

  const r = await pool.query(
    `select id, subscription_json
     from push_subscriptions
     where user_id = $1`,
    [userId]
  );

  for (const row of r.rows || []) {
    try {
      const sub = JSON.parse(row.subscription_json);
      await wp.sendNotification(sub, payload);
    } catch (e) {
      const msg = String(e?.message || e);
      // subscription expirou / inválida
      if (msg.includes("410") || msg.includes("404")) {
        try {
          await pool.query(`delete from push_subscriptions where id = $1`, [row.id]);
        } catch {}
      }
    }
  }
}