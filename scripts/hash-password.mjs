import crypto from "crypto";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const rl = readline.createInterface({ input, output });
const password = await rl.question("Password a convertir en hash: ");
rl.close();

const salt = crypto.randomBytes(16).toString("base64url");
const hash = crypto.scryptSync(password, salt, 64).toString("base64url");

console.log(`scrypt:${salt}:${hash}`);
