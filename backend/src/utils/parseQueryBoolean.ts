/**
 * Express pode devolver query como string ("true") ou, com alguns parsers, boolean (true).
 * Comparação estrita com apenas "true" quebra o modo "ver todos" (admin / Kanban).
 */
export function parseTruthyQuery(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}
