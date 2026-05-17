import { getSessionFromRequest } from "../../lib/session";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  return res.status(200).json({
    email: session.email,
    role: session.role,
    expiresAt: session.expiresAt
  });
}
