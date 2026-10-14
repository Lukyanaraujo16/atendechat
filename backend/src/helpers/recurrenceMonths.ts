/**
 * Periodicidades SaaS aprovadas: meses-calendário (não +30 dias fixos).
 * BIMESTRAL mantido por compatibilidade legada.
 */
export const MONTHS_BY_RECURRENCE: Record<string, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12
};

export const ALLOWED_RECURRENCES = [
  "MENSAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL"
] as const;

export type AllowedRecurrence = (typeof ALLOWED_RECURRENCES)[number];

export function getRecurrenceMonths(recurrence: string | null | undefined): number | null {
  const rec = String(recurrence || "").toUpperCase().trim();
  const months = MONTHS_BY_RECURRENCE[rec];
  return months ?? null;
}

export function normalizeRecurrence(recurrence: string | null | undefined): string {
  return String(recurrence || "MENSAL").toUpperCase().trim();
}
