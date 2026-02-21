import express from "express";
import { addMemory, searchMemories } from "../memory/store.js";

export const memoryRouter = express.Router();

memoryRouter.post("/add", async (req, res) => {
  try {
    const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
    const { kind = "note", text = "", meta = {} } = req.body || {};

    if (!text.trim()) return res.status(400).json({ error: "text obrigatório" });

    await addMemory(userId, kind, text, meta);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

memoryRouter.post("/search", async (req, res) => {
  try {
    const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
    const { query = "", limit = 6 } = req.body || {};

    if (!query.trim()) return res.status(400).json({ error: "query obrigatória" });

    const results = await searchMemories(userId, query, Number(limit) || 6);
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});
