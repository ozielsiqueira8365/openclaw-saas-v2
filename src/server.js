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
    port: Number(process.env.PORT || 3000),
    db: process.env.DATABASE_URL ? "postgres" : "none",
    llm: {
      baseUrl: process.env.MOONSHOT_BASE_URL,
      model: process.env.MOONSHOT_MODEL
    }
  });
});

// ✅ Em produção é recomendado desativar admin
if (process.env.NODE_ENV !== "production") {
  app.use(adminRouter());
}

// ✅ chatRouter agora é uma FUNÇÃO que retorna o router
app.use(chatRouter());

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SaaS v2 online na porta ${PORT}`);
});

// Debug: se fechar sozinho, você vê
server.on("close", () => console.log("🧨 server CLOSE event disparado"));
process.on("exit", (code) => console.log("🧨 process EXIT:", code));
process.on("uncaughtException", (err) => console.log("💥 uncaughtException:", err));
process.on("unhandledRejection", (err) => console.log("💥 unhandledRejection:", err));