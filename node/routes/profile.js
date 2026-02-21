import express from "express";
import { getUserProfile, setUserProfile } from "../memory/store.js";

export const profileRouter = express.Router();

profileRouter.get("/", (req, res) => {
  const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
  res.json({ userId, profile: getUserProfile(userId) });
});

profileRouter.post("/", (req, res) => {
  const userId = req.header("X-User-Id") || req.header("X-Session-Id") || "anon";
  setUserProfile(userId, req.body || {});
  res.json({ ok: true });
});
