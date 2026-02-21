import crypto from "crypto";

export const KEY_PREFIX = "oc_live_";

export function generateSecret(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function buildFullKey(secret) {
  const idPart = crypto.randomBytes(9).toString("base64url");
  return `${KEY_PREFIX}${idPart}.${secret}`;
}

export function splitKey(full) {
  if (!full || typeof full !== "string") return null;
  const dot = full.indexOf(".");
  if (dot < 0) return null;
  return { prefix: full.slice(0, dot), secret: full.slice(dot + 1) };
}

export function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function last4(secret) {
  return (secret || "0000").slice(-4);
}