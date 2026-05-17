import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { signedUrl } from "../../lib/pdfStorage";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const { data, error } = await supabaseAdmin
    .from("biblioteca")
    .select("*")
    .eq("visible", true)
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
