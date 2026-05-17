import { supabaseAdmin } from "./supabaseAdmin";

export const DOCS_BUCKET = "celider17-docs";
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export function cleanFilePart(value, fallback = "documento") {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || fallback;
}

export function readPdfBase64({ fileBase64, fileName }) {
  const base64 = String(fileBase64 || "").replace(/^data:application\/pdf;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length || buffer.length > MAX_PDF_BYTES) {
    throw new Error("El PDF debe pesar menos de 8 MB.");
  }

  const header = buffer.subarray(0, 4).toString("utf8");
  if (header !== "%PDF") {
    throw new Error("Solo se permiten archivos PDF validos.");
  }

  return {
    buffer,
    fileName: cleanFilePart(fileName || "documento.pdf").replace(/\.pdf$/i, "") + ".pdf"
  };
}

export async function uploadPdf({ folder, type, fileBase64, fileName, owner }) {
  const pdf = readPdfBase64({ fileBase64, fileName });
  const safeOwner = cleanFilePart(owner || "anonimo");
  const safeType = cleanFilePart(type || "documento");
  const path = `${cleanFilePart(folder)}/${safeOwner}/${safeType}-${Date.now()}-${pdf.fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(DOCS_BUCKET)
    .upload(path, pdf.buffer, {
      contentType: "application/pdf",
      upsert: false
    });

  if (error) throw error;
  return path;
}

export async function signedUrl(path, expiresIn = 60 * 60) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) return null;
  return data?.signedUrl || null;
}
