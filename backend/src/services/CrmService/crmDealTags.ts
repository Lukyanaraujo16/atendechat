import type { CrmDealPriority } from "../../models/CrmDeal";

const ALLOWED_PRIORITY = new Set<string>([
  "low",
  "medium",
  "high",
  "urgent"
]);

export function normalizeDealPriority(value: unknown): CrmDealPriority {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (ALLOWED_PRIORITY.has(s)) {
    return s as CrmDealPriority;
  }
  return "medium";
}

/** Até 10 etiquetas; cada uma até 30 caracteres; strings vazias ignoradas. */
export function sanitizeDealTags(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= 10) break;
    const t = String(item ?? "")
      .trim()
      .slice(0, 30);
    if (t) out.push(t);
  }
  return out;
}
