import express from "express";
import { dbi } from "../db/index.js";
import { startScheduler } from "../jobs/scheduler.js";

export const proactiveRouter = express.Router();

proactiveRouter.get("/vapidPublicKey", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

proactiveRouter.post("/subscribe", async (req, res) => {
  const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
  const sub = req.body;
  if (!sub) return res.status(400).json({ error: "subscription obrigatória" });

  const subJson = JSON.stringify(sub);

  if (process.env.DATABASE_URL) {
    await dbi.query(
      "INSERT INTO push_subscriptions(user_id, subscription_json) VALUES($1, $2)",
      [userId, subJson]
    );
  } else {
    await dbi.query(
      "INSERT INTO push_subscriptions(user_id, subscription_json) VALUES(?, ?)",
      [userId, subJson]
    );
  }

  res.json({ ok: true });
});

proactiveRouter.post("/jobs/add", async (req, res) => {
  const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
  const { name, cron, payload = {}, enabled = 1 } = req.body || {};
  if (!name || !cron) return res.status(400).json({ error: "name e cron obrigatórios" });

  const payloadJson = JSON.stringify(payload);

  if (process.env.DATABASE_URL) {
    await dbi.query(
      `INSERT INTO scheduled_jobs(user_id, name, cron, payload_json, enabled)
       VALUES($1, $2, $3, $4, $5)`,
      [userId, name, cron, payloadJson, enabled ? 1 : 0]
    );
  } else {
    await dbi.query(
      `INSERT INTO scheduled_jobs(user_id, name, cron, payload_json, enabled)
       VALUES(?, ?, ?, ?, ?)`,
      [userId, name, cron, payloadJson, enabled ? 1 : 0]
    );
  }

  startScheduler();
  res.json({ ok: true });
});

proactiveRouter.post("/jobs/reload", (req, res) => {
  startScheduler();
  res.json({ ok: true });
});
