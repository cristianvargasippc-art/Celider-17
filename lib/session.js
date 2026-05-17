import crypto from "crypto";

const COOKIE_NAME = "celider_session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken({ email, role }) {
  const durationHours = Number(process.env.SESSION_DURATION_HOURS || 8);
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;
  const payload = base64url(JSON.stringify({ email, role, expiresAt }));
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length) return null;

  const validSignature = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!validSignature) return null;

  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.expiresAt || session.expiresAt <= Date.now()) return null;

  return session;
}

export function getSessionFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return [name, rest.join("=")];
    })
  );

  return verifySessionToken(cookies[COOKIE_NAME]);
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Number(process.env.SESSION_DURATION_HOURS || 8) * 60 * 60;

  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
