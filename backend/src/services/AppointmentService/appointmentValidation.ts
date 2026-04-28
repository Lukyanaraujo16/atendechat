import AppError from "../../errors/AppError";

/** Intervalo máximo permitido em GET /appointments (listagens amplas) — ~3 meses */
export const MAX_LIST_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

/** Duração máxima de um único evento (evita abusos) */
export const MAX_EVENT_DURATION_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Datas vêm do cliente em ISO 8601 (UTC ou offset). O Node interpreta e o
 * Sequelize grava em UTC no típico TIMESTAMP WITH TIME ZONE.
 */
const APPOINTMENT_HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

/**
 * Cor opcional do compromisso (#rrggbb). `undefined` = não alterar; `null`/"" = limpar.
 */
export const parseAppointmentColor = (
  value: unknown
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  const s = String(value).trim();
  if (!APPOINTMENT_HEX_COLOR.test(s)) {
    throw new AppError("Cor inválida. Use formato hexadecimal (#rrggbb).", 400);
  }
  return s.toLowerCase();
};

export const parseAppointmentInputDate = (value: unknown, field: string): Date => {
  if (value == null || value === "") {
    throw new AppError(`Campo ${field} é obrigatório.`, 400);
  }
  const s = String(value);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(`Data inválida: ${field}.`, 400);
  }
  return d;
};

export const assertValidDate = (d: Date, field: string): void => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new AppError(`Data inválida: ${field}.`, 400);
  }
};

export const assertEventDateOrder = (startAt: Date, endAt: Date): void => {
  assertValidDate(startAt, "início");
  assertValidDate(endAt, "fim");
  if (endAt.getTime() <= startAt.getTime()) {
    throw new AppError("A data/hora de fim deve ser posterior à de início.", 400);
  }
  if (endAt.getTime() - startAt.getTime() > MAX_EVENT_DURATION_MS) {
    throw new AppError("Duração do evento excede o limite permitido (366 dias).", 400);
  }
};

export const assertListDateRange = (start: Date, end: Date): void => {
  assertValidDate(start, "start");
  assertValidDate(end, "end");
  if (end.getTime() <= start.getTime()) {
    throw new AppError("O parâmetro end deve ser posterior a start.", 400);
  }
  const span = end.getTime() - start.getTime();
  if (span > MAX_LIST_RANGE_MS) {
    throw new AppError("Intervalo de busca muito longo. Máximo: 92 dias.", 400);
  }
};

/**
 * Remove o criador, duplicados e valores inválidos. Apenas inteiros positivos.
 */
export const normalizeParticipantUserIds = (raw: unknown, creatorUserId: number): number[] => {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new AppError("participantUserIds deve ser um array.", 400);
  }
  const creator = Number(creatorUserId);
  const set = new Set<number>();
  for (const x of raw) {
    const n = Number(x);
    if (Number.isInteger(n) && n > 0 && n !== creator) {
      set.add(n);
    }
  }
  return Array.from(set);
};
