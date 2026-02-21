import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function is429(err) {
  const msg = String(err?.message || err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
}

export async function generateWithRetry({ model = "gemini-2.5-flash", text, maxRetries = 3 }) {
  let attempt = 0;
  let lastErr;

  while (attempt <= maxRetries) {
    try {
      const m = genAI.getGenerativeModel({ model });
      const res = await m.generateContent(text);
      return { ok: true, text: res?.response?.text?.() ?? "" };
    } catch (e) {
      lastErr = e;
      if (!is429(e)) break;

      const base = 900 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 400);
      await sleep(base + jitter);
      attempt++;
    }
  }

  return { ok: false, error: lastErr, is429: is429(lastErr) };
}
