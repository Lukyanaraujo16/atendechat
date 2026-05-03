/** Segmentos de negócio (empresa + templates de CRM). */
export const BUSINESS_SEGMENTS = [
  "general",
  "clinic",
  "aesthetic_clinic",
  "real_estate",
  "gym",
  "school",
  "ecommerce",
  "automotive",
  "financial",
  "legal",
  "healthcare",
  "other"
] as const;

export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];

const SET = new Set<string>(BUSINESS_SEGMENTS);

export function normalizeBusinessSegment(
  value: string | null | undefined
): BusinessSegment {
  const v = String(value || "").trim();
  if (!v || !SET.has(v)) return "general";
  return v as BusinessSegment;
}

export function isValidBusinessSegment(value: string): boolean {
  return SET.has(String(value || "").trim());
}
