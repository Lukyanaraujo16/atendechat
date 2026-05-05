/** Espelha `backend/src/helpers/companyStorage.ts` — valores pequenos legíveis (ex.: 512 B, 1,23 KB). */
export function formatBytesPtBr(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b < 0) return "0 B";
  if (b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  let n = b;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  let maxFraction = 0;
  if (u === 0) maxFraction = 0;
  else if (u === 1) maxFraction = n < 10 ? 2 : 1;
  else maxFraction = 2;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  })} ${units[u]}`;
}
