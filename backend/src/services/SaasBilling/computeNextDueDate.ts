import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import { getRecurrenceMonths, normalizeRecurrence } from "../../helpers/recurrenceMonths";

export type ComputeNextDueDateInput = {
  currentDueDate?: string | null;
  recurrence: string | null | undefined;
  timezone?: string | null;
  /** Se true, baseia em hoje mesmo se dueDate futuro (ajuste administrativo). */
  forceFromToday?: boolean;
};

/**
 * Próximo vencimento por meses-calendário (nunca +30 dias fixos).
 */
export function computeNextDueDate(input: ComputeNextDueDateInput): {
  newDueDate: string;
  months: number;
  recurrence: string;
  previousDueDate: string | null;
} {
  const recurrence = normalizeRecurrence(input.recurrence);
  const months = getRecurrenceMonths(recurrence);
  if (!months) {
    throw new AppError(
      "ERR_INVALID_RECURRENCE",
      400,
      "Defina a recorrência da empresa (MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL)."
    );
  }

  const tzRaw = input.timezone?.trim();
  const tz = tzRaw && moment.tz.zone(tzRaw) ? tzRaw : "America/Sao_Paulo";
  const now = moment.tz(tz).startOf("day");
  let base = now;

  if (!input.forceFromToday && input.currentDueDate) {
    const due = moment.tz(input.currentDueDate, tz).startOf("day");
    if (due.isValid() && due.isSameOrAfter(now)) {
      base = due;
    }
  }

  return {
    newDueDate: base.clone().add(months, "months").format("YYYY-MM-DD"),
    months,
    recurrence,
    previousDueDate: input.currentDueDate || null
  };
}

export function buildCycleKey(dueDate: string): string {
  const m = moment(dueDate);
  if (!m.isValid()) {
    return moment().format("YYYY-MM");
  }
  return m.format("YYYY-MM");
}

export function buildCompetence(dueDate: string): string {
  return buildCycleKey(dueDate);
}
