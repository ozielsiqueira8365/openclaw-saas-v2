import express from "express";
import { addMemory } from "../memory/store.js";

export const webhooksRouter = express.Router();

webhooksRouter.post("/automation", async (req, res) => {
  try {
    const secret = req.header("X-Webhook-Secret") || "";

    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const userId =
      req.header("X-User-Id") ||
      req.header("X-Session-Id") ||
      "anon";

    const payload = req.body || {};
    const text = payload.text || JSON.stringify(payload);

    await addMemory(userId, "event", text, {
      source: "webhook",
      payload
    });

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ error: "Erro no webhook." });
  }
});
