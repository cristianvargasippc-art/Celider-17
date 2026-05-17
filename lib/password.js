import crypto from "crypto";

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const separator = storedHash.includes("$") ? "$" : ":";
  const [algorithm, salt, hash] = storedHash.split(separator);
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, 64).toString("base64url");

  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
