import { rateLimit } from "../../lib/rateLimit";
import { sanitizeString, validateEmail } from "../../lib/sanitize";
import { uploadPdf } from "../../lib/pdfStorage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "35mb"
    }
  }
};

const ALLOWED_TYPES = ["cedula", "foto"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const { allowed } = rateLimit({ key: `upload-doc:${ip}`, limit: 12, windowMs: 60 * 60 * 1000 });
  if (!allowed) return res.status(429).json({ error: "Demasiados documentos. Intenta mas tarde." });

  try {
    const type = sanitizeString(req.body?.type || "", 20);
    const email = sanitizeString(req.body?.email || "", 200).toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: "Tipo de documento invalido." });
    if (!validateEmail(email)) return res.status(400).json({ error: "Correo invalido para subir documentos." });

    const path = await uploadPdf({
      folder: "registros",
      type,
      owner: email,
      fileName: req.body?.fileName,
      fileBase64: req.body?.fileBase64
    });

    return res.status(200).json({ ok: true, path });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo subir el PDF." });
  }
}
