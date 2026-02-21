import "dotenv/config";
import express from "express";
import { pool } from "./db/pool.js"; // se seu pool estiver em outro caminho, ajuste esta linha

const app = express();

// ✅ logs simples
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// ✅ JSON parser (seguro)
app.use(express.json({ limit: "1mb" }));

// ✅ Rotas básicas (pra provar que o app responde)
app.get("/", (_req, res) => res.status(200).send("OpenClaw SaaS v2 online ✅"));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({
      ok: true,
      port: Number(process.env.PORT || 8080),
      db: "postgres",
      llm: {
        baseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
        model: process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.5"
      }
    });
  } catch (e) {
    console.error("[health] db error:", e?.message || e);
    return res.status(500).json({ ok: false, db: "down" });
  }
});

app.get("/__ping", (_req, res) => res.status(200).send("pong"));
app.post("/__ping", (_req, res) => res.status(200).json({ ok: true }));

// ✅ Captura erros globais (evita crash silencioso)
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

const PORT = Number(process.env.PORT || 8080);

// ✅ Subir server com timeouts
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SaaS v2 online na porta ${PORT}`);
});

// Ajustes de timeout (evita conexões penduradas)
server.requestTimeout = 60_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 65_000;