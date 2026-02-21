export function splitTextIntoChunks(
  text,
  { chunkSizeChars = 1800, overlapChars = 250, minChunkChars = 200 } = {}
) {
  const clean = (text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!clean) return [];

  const paragraphs = clean
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let buf = "";

  for (const p of paragraphs) {
    const candidate = buf ? `${buf}\n\n${p}` : p;

    if (candidate.length <= chunkSizeChars) {
      buf = candidate;
      continue;
    }

    if (buf.length >= minChunkChars) chunks.push(buf);

    if (p.length > chunkSizeChars) {
      let i = 0;
      while (i < p.length) {
        const part = p.slice(i, i + chunkSizeChars).trim();
        if (part.length >= minChunkChars) chunks.push(part);
        i += chunkSizeChars - overlapChars;
      }
      buf = "";
    } else {
      buf = p;
    }
  }

  if (buf.length >= minChunkChars) chunks.push(buf);

  const withOverlap = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      withOverlap.push(chunks[i]);
      continue;
    }
    const prev = withOverlap[withOverlap.length - 1] || "";
    const tail = prev.slice(-overlapChars);
    withOverlap.push(`${tail}\n${chunks[i]}`.trim());
  }

  return withOverlap;
}
