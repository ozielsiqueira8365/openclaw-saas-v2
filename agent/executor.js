import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function runChatReply(task) {
  const payload = task.payload || {};
  const prompt = payload.prompt || `Pergunta: ${payload.message || ""}`;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
  });

  const result = await model.generateContent(prompt);
  const text = result?.response?.text?.() ?? "";

  return {
    reply: text,
    userId: payload.userId || null,
    mode: payload.mode || "geral"
  };
}

export async function executeTask(task) {
  const type = String(task?.task_type || "");

  // ✅ NOVO: task do fallback 429 do chat
  if (type === "chat_reply") {
    return await runChatReply(task);
  }

  // ✅ Mantém tudo antigo funcionando
  try {
    const old = await import("./executor_old.js");
    if (typeof old.executeTask !== "function") {
      throw new Error("executor_old.js não exporta executeTask");
    }
    return await old.executeTask(task);
  } catch (e) {
    throw new Error(`executor_old falhou para task_type='${type}': ${String(e?.message || e)}`);
  }
}
