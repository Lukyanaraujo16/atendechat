/** Gera chave estável a partir do rótulo (snake_case, sem acentos). */
export function labelToCrmCustomFieldKey(label: string): string {
  const raw = String(label || "").trim();
  if (!raw) return "campo";
  const ascii = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let key = ascii
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (!key) key = "campo";
  return key;
}
