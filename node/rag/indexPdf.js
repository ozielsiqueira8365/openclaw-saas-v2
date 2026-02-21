import { v4 as uuidv4 } from "uuid";
import { splitTextIntoChunks } from "./textSplit.js";
import { embedTexts } from "./embeddings.js";
import { saveIndex } from "./vectorStore.js";

export async function indexPdfBuffer(
  pdfBuffer,
  { originalName = "documento.pdf", docId = uuidv4() } = {}
) {
  // ✅ pdf-parse é CommonJS; em ESM precisamos desse bridge:
  const pdfModule = await import("pdf-parse");
  const pdfParse = pdfModule.default || pdfModule;

  const data = await pdfParse(pdfBuffer);

  const text = (data.text || "").trim();
  const probablyScanned = text.length < 800;

  const chunks = splitTextIntoChunks(text, {
    chunkSizeChars: 1800,
    overlapChars: 250,
    minChunkChars: 200
  });

  if (!chunks.length) {
    const payload = {
      docId,
      originalName,
      createdAt: new Date().toISOString(),
      meta: { probablyScanned, pages: data.numpages || null },
      chunks: []
    };
    saveIndex(docId, payload);
    return payload;
  }

  const vectors = await embedTexts(chunks);

  const payload = {
    docId,
    originalName,
    createdAt: new Date().toISOString(),
    meta: { probablyScanned, pages: data.numpages || null },
    chunks: chunks.map((content, i) => ({
      id: `${docId}:${i}`,
      content,
      embedding: vectors[i]
    }))
  };

  saveIndex(docId, payload);
  return payload;
}
