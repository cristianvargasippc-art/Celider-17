import { getSessionFromRequest } from "../../../lib/session";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { signedUrl, uploadPdf } from "../../../lib/pdfStorage";
import { sanitizeString } from "../../../lib/sanitize";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "35mb"
    }
  }
};

function requireAdmin(req, res) {
  const session = getSessionFromRequest(req);
  if (!session || !["admin", "secretaria", "superadmin"].includes(session.role)) {
    res.status(403).json({ error: "Acceso denegado" });
    return null;
  }
  return session;
}

async function listDocs(res) {
  const { data, error } = await supabaseAdmin
    .from("biblioteca")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "No se pudo cargar la biblioteca." });

  const docs = await Promise.all(
    (data || []).map(async (doc) => ({
      ...doc,
      url: await signedUrl(doc.file_path)
    }))
  );

  return res.status(200).json({ data: docs });
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") return listDocs(res);

  if (req.method === "POST") {
    try {
      const titulo = sanitizeString(req.body?.titulo || "", 140);
      const descripcion = sanitizeString(req.body?.descripcion || "", 500);
      const categoria = sanitizeString(req.body?.categoria || "Manual", 60);
      const visible = req.body?.visible !== false;

      if (!titulo) return res.status(400).json({ error: "Ingresa el título del documento." });

      const filePath = await uploadPdf({
        folder: "biblioteca",
        type: categoria,
        owner: titulo,
        fileName: req.body?.fileName,
        fileBase64: req.body?.fileBase64
      });

      const { data, error } = await supabaseAdmin
        .from("biblioteca")
        .insert({
          titulo,
          descripcion,
          categoria,
          file_path: filePath,
          file_name: sanitizeString(req.body?.fileName || "", 160),
          visible,
          publicado_por: session.email
        })
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "No se pudo publicar el documento." });

      return res.status(200).json({ ok: true, data: { ...data, url: await signedUrl(data.file_path) } });
    } catch (error) {
      return res.status(400).json({ error: error.message || "No se pudo subir el PDF." });
    }
  }

  if (req.method === "PATCH") {
    const id = req.body?.id;
    const visible = Boolean(req.body?.visible);
    const { error } = await supabaseAdmin
      .from("biblioteca")
      .update({ visible })
      .eq("id", id);

    if (error) return res.status(500).json({ error: "No se pudo actualizar el documento." });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: "Metodo no permitido" });
}
