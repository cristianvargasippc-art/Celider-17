import crypto from "crypto";
import fs from "fs";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

function readEnvFile(path) {
  const env = {};
  const content = fs.readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }

  return env;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, 64).toString("base64url");
  if (candidate.length !== hash.length) return false;

  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

const env = readEnvFile(".env.local");
const rl = readline.createInterface({ input, output });
const password = await rl.question("Password a probar: ");
rl.close();

const adminOk = verifyPassword(password, env.ADMIN_PASSWORD_HASH);
const secretariaOk = verifyPassword(password, env.SECRETARIA_PASSWORD_HASH);

console.log("");
console.log(`ADMIN_EMAIL: ${env.ADMIN_EMAIL || "(no definido)"}`);
console.log(`ADMIN_PASSWORD_HASH: ${env.ADMIN_PASSWORD_HASH ? "definido" : "no definido"}`);
console.log(`Admin coincide: ${adminOk ? "SI" : "NO"}`);
console.log("");
console.log(`SECRETARIA_EMAIL: ${env.SECRETARIA_EMAIL || "(no definido)"}`);
console.log(`SECRETARIA_PASSWORD_HASH: ${env.SECRETARIA_PASSWORD_HASH ? "definido" : "no definido"}`);
console.log(`Secretaria coincide: ${secretariaOk ? "SI" : "NO"}`);
