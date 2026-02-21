import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { adminRouter } from "./routes/admin.js";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    port: Number(process.env.PORT || 8080),
    db: process.env.DATABASE_URL ? "postgres" : "none",
    llm: {
      baseUrl: process.env.MOONSHOT_BASE_URL,
      model: process.env.MOONSHOT_MODEL
    }
  });
});

// ✅ ADMIN router já tem "/admin/..." DENTRO das rotas.
// Então aqui tem que ser na raiz:
if (process.env.ADMIN_TOKEN) {
  app.use(adminRouter()); // <- CHAMAR a função
} else {
  console.warn("⚠️ ADMIN_TOKEN não configurado. Rotas /admin/* desativadas.");
}

// ✅ Chat router (router pronto /v1/chat etc.)
app.use(chatRouter);

// ✅ 404 em JSON (melhor que "Cannot POST ...")
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found", path: req.path });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SaaS v2 online na porta ${PORT}`);
});