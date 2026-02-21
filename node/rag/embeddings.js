import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("❌ Defina GEMINI_API_KEY (ou GOOGLE_API_KEY) no .env");

const ai = new GoogleGenAI({ apiKey });

export async function embedTexts(texts) {
  const resp = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
  });

  const embeddings = resp.embeddings?.map((e) => e.values) || [];
  if (!embeddings.length) throw new Error("❌ Embedding retornou vazio. Verifique API key/model.");
  return embeddings;
}

export async function embedQuery(text) {
  const [vec] = await embedTexts([text]);
  return vec;
}
