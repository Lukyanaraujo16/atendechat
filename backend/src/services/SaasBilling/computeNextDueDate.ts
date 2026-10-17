import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import { getRecurrenceMonths, normalizeRecurrence } from "../../helpers/recurrenceMonths";
import {
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";

export type ComputeNextDueDateInput = {
  /** Aceita Date (timestamptz vindo do pg), ISO ou YYYY-MM-DD. */
  currentDueDate?: Date | string | null;
  recurrence: string | null | undefined;
  timezone?: string | null;
  /** Se true, baseia em hoje mesmo se dueDate futuro (ajuste administrativo). */
  forceFromToday?: boolean;
  /** Hoje em YYYY-MM-DD (testes); padrão: hoje no fuso da empresa. */
  today?: string;
};

export type ComputeNextDueDateResult = {
  newDueDate: string;
  months: number;
  recurrence: string;
  /** Vencimento atual normalizado (YYYY-MM-DD) ou null. */
  previousDueDate: string | null;
  /** Vencimento atual já passou. */
  overdue: boolean;
  /** Ciclos inteiros que ficaram para trás ao avançar até um vencimento futuro. */
  cyclesSkipped: number;
};

/**
 * Próximo vencimento por meses-calendário (nunca +30 dias fixos), preservando o dia contratual.
 *
 * - Sem vencimento: hoje + período.
 * - Vencimento em dia (>= hoje): vencimento + período.
 * - Vencido: avança em múltiplos do período a partir do vencimento original até ficar
 *   estritamente no futuro — nunca gera um vencimento já expirado e não desloca o dia contratual.
 *   Ciclos pulados não são cobrados automaticamente (faturas abertas continuam abertas).
 */
export function computeNextDueDate(
  input: ComputeNextDueDateInput
): ComputeNextDueDateResult {
  const recurrence = normalizeRecurrence(input.recurrence);
  const months = getRecurrenceMonths(recurrence);
  if (!months) {
    throw new AppError(
      "ERR_INVALID_RECURRENCE",
      400,
      "Defina a recorrência da empresa (MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL)."
    );
  }

  const tz = resolveSaasTimezone(input.timezone);
  const todayStr = input.today || todayDomainDate(tz);
  const today = moment.tz(todayStr, "YYYY-MM-DD", tz);
  const previousDueDate = toDomainDate(input.currentDueDate, tz);

  if (input.forceFromToday || !previousDueDate) {
    return {
      newDueDate: today.clone().add(months, "months").format("YYYY-MM-DD"),
      months,
      recurrence,
      previousDueDate,
      overdue: !!previousDueDate && previousDueDate < todayStr,
      cyclesSkipped: 0
    };
  }

  const anchor = moment.tz(previousDueDate, "YYYY-MM-DD", tz);
  const overdue = anchor.isBefore(today, "day");

  let cycles = 1;
  let next = anchor.clone().add(months, "months");
  if (overdue) {
    // Sempre a partir da âncora original para não acumular deriva de fim de mês (31 → 28 → 28...).
    while (!next.isAfter(today, "day")) {
      cycles += 1;
      next = anchor.clone().add(months * cycles, "months");
    }
  }

  return {
    newDueDate: next.format("YYYY-MM-DD"),
    months,
    recurrence,
    previousDueDate,
    overdue,
    cyclesSkipped: cycles - 1
  };
}

/** Fim do período coberto por uma fatura (vencimento da fatura + período), ou null se indeterminado. */
export function computeInvoiceCoverageEnd(
  invoiceDueDate: Date | string | null | undefined,
  recurrence: string | null | undefined,
  timezone?: string | null
): string | null {
  const months = getRecurrenceMonths(normalizeRecurrence(recurrence));
  const tz = resolveSaasTimezone(timezone);
  const due = toDomainDate(invoiceDueDate, tz);
  if (!months || !due) return null;
  return moment
    .tz(due, "YYYY-MM-DD", tz)
    .add(months, "months")
    .format("YYYY-MM-DD");
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
