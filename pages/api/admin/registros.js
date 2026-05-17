import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSessionFromRequest } from "../../../lib/session";
import { signedUrl } from "../../../lib/pdfStorage";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const session = getSessionFromRequest(req);
  if (!session || !["admin", "secretaria", "superadmin"].includes(session.role)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const distrito = typeof req.query.distrito === "string" ? req.query.distrito : "";
  let query = supabaseAdmin
    .from("registros")
    .select("*")
    .order("created_at", { ascending: false });

  if (distrito) query = query.eq("distrito", distrito);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: "No se pudieron cargar los registros" });

  const registros = await Promise.all(
    (data || []).map(async (registro) => ({
      ...registro,
      cedula_url: await signedUrl(registro.cedula_file),
      foto_url: await signedUrl(registro.foto_file)
    }))
  );

  return res.status(200).json({ data: registros, registros });
}
