/**
 * Combinação canônica de opções de atributo.
 * Ordena por attributeId para unicidade independente da ordem de entrada.
 */

export type CombinationOptionInput = {
  attributeId: number;
  optionId: number;
  attributeName?: string;
  optionValue?: string;
};

export function buildCombinationKey(
  options: Array<{ attributeId: number; optionId: number }>
): string {
  const sorted = [...options].sort((a, b) => {
    if (a.attributeId !== b.attributeId) return a.attributeId - b.attributeId;
    return a.optionId - b.optionId;
  });
  return sorted.map(o => `${o.attributeId}:${o.optionId}`).join("|");
}

export function buildVariantLabel(
  options: Array<{ attributeName: string; optionValue: string }>
): string {
  return options
    .map(o => String(o.optionValue || "").trim())
    .filter(Boolean)
    .join(" / ");
}

export function parseOptionIds(raw: unknown): CombinationOptionInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const out: CombinationOptionInput[] = [];
  const seenAttrs = new Set<number>();
  for (const row of raw) {
    const attributeId = Number((row as { attributeId?: unknown })?.attributeId);
    const optionId = Number((row as { optionId?: unknown })?.optionId);
    if (!Number.isFinite(attributeId) || !Number.isFinite(optionId)) continue;
    if (seenAttrs.has(attributeId)) continue;
    seenAttrs.add(attributeId);
    out.push({ attributeId, optionId });
  }
  return out;
}
