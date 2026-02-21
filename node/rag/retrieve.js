import { loadIndex } from "./vectorStore.js";
import { embedQuery } from "./embeddings.js";

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}
function cosineSim(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}

export async function retrieveTopK({ docId, query, k = 6 }) {
  const idx = loadIndex(docId);
  if (!idx) throw new Error("❌ Índice RAG não encontrado para esse docId.");

  if (!idx.chunks?.length) {
    return {
      hits: [],
      notice: idx.meta?.probablyScanned
        ? "PDF parece escaneado (OCR ainda não aplicado)."
        : "PDF sem texto extraível.",
    };
  }

  const qVec = await embedQuery(query);

  const scored = idx.chunks.map((ch) => ({
    ...ch,
    score: cosineSim(qVec, ch.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const hits = scored.slice(0, k).filter((h) => h.score > 0.15);
  return { hits, notice: null };
}

export function buildContextWithCitations(hits) {
  let context = "";
  const citations = [];

  hits.forEach((h, i) => {
    const tag = `[C${i + 1}]`;
    context += `${tag} ${h.content}\n\n`;
    citations.push({ tag, chunkId: h.id, score: Number(h.score.toFixed(3)) });
  });

  return { context: context.trim(), citations };
}
