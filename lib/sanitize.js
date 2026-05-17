export function sanitizeText(value, maxLength = 255) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, maxLength);
}

export function sanitizeEmail(value) {
  return sanitizeText(value, 254).toLowerCase();
}

export function sanitizeString(value, maxLength = 500) {
  return sanitizeText(value, maxLength)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

export function validateTelefono(telefono) {
  return /^[\d+\-()\s]{7,20}$/.test(String(telefono || ""));
}
