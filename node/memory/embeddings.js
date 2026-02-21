import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

function fallbackVector(text) {
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9áàâãéêíóôõúç\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 256);

  const dims = 128;
  const vec = new Array(dims).fill(0);

  for (const t of tokens) {
    const h = crypto.createHash("sha256").update(t).digest();
    const idx = h[0] % dims;
    vec[idx] += 1;
  }

  const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export async function embedText(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
  if (!apiKey) return fallbackVector(text);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const emb = await genAI.embedContent({
      model,
      content: { parts: [{ text }] }
    });

    const values = emb?.embedding?.values;
    if (Array.isArray(values) && values.length > 0) return values;

    return fallbackVector(text);
  } catch {
    return fallbackVector(text);
  }
}

export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}
