import fs from "fs";
import path from "path";

const baseDir = path.join(process.cwd(), "storage", "rag");
fs.mkdirSync(baseDir, { recursive: true });

function fileOf(docId) {
  return path.join(baseDir, `${docId}.json`);
}

export function saveIndex(docId, payload) {
  fs.writeFileSync(fileOf(docId), JSON.stringify(payload, null, 2), "utf-8");
}

export function loadIndex(docId) {
  const f = fileOf(docId);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf-8"));
}
