import AppError from "../../errors/AppError";
import { roundMoney } from "./inventorySaleHelpers";

export type StoreCreditFrequency = "once" | "weekly" | "biweekly" | "monthly";

export type StoreCreditInstallmentPreview = {
  sequence: number;
  dueDate: string; // YYYY-MM-DD civil
  amount: number;
};

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertCivilDateString(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!CIVIL_DATE_RE.test(raw)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Data de vencimento inválida. Use YYYY-MM-DD."
    );
  }
  const [y, m, d] = raw.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Data de vencimento inválida."
    );
  }
  return raw;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCivil(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseCivil(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Soma dias civis preservando calendário (UTC date components). */
export function addCivilDays(date: string, days: number): string {
  const { y, m, d } = parseCivil(date);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return formatCivil(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate()
  );
}

/**
 * Avança N meses civis com clamping do dia (ex.: 31 → último dia de fev).
 * Mantém o dia de referência original quando possível.
 */
export function addCivilMonthsClamped(
  date: string,
  months: number,
  anchorDay: number
): string {
  const { y, m } = parseCivil(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = daysInMonth(ny, nm);
  const nd = Math.min(anchorDay, dim);
  return formatCivil(ny, nm, nd);
}

export function distributeExactCents(
  totalAmount: number,
  installmentCount: number
): number[] {
  const total = roundMoney(totalAmount);
  if (total <= 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Valor financiado deve ser maior que zero."
    );
  }
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 120
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Número de parcelas inválido."
    );
  }

  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / installmentCount);
  const remainder = totalCents - base * installmentCount;
  const amounts: number[] = [];
  for (let i = 0; i < installmentCount; i += 1) {
    const cents = i === installmentCount - 1 ? base + remainder : base;
    amounts.push(roundMoney(cents / 100));
  }
  return amounts;
}

export function parseStoreCreditFrequency(value: unknown): StoreCreditFrequency {
  const freq = String(value ?? "").trim();
  if (
    freq !== "once" &&
    freq !== "weekly" &&
    freq !== "biweekly" &&
    freq !== "monthly"
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Condição de Crédito da Loja inválida."
    );
  }
  return freq;
}

/**
 * Gera preview/parcelas civis. Remainder de centavos na última parcela.
 */
export function generateStoreCreditSchedule(input: {
  financedAmount: number;
  frequency: StoreCreditFrequency | unknown;
  installmentCount: number;
  firstDueDate: unknown;
}): StoreCreditInstallmentPreview[] {
  const frequency = parseStoreCreditFrequency(input.frequency);
  const firstDueDate = assertCivilDateString(input.firstDueDate);
  let count = input.installmentCount;

  if (frequency === "once") {
    count = 1;
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Número de parcelas inválido."
    );
  }
  if (frequency === "once" && count !== 1) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Condição de data única exige 1 parcela."
    );
  }

  const amounts = distributeExactCents(input.financedAmount, count);
  const anchorDay = parseCivil(firstDueDate).d;
  const rows: StoreCreditInstallmentPreview[] = [];

  for (let i = 0; i < count; i += 1) {
    let dueDate = firstDueDate;
    if (i > 0) {
      if (frequency === "weekly") {
        dueDate = addCivilDays(firstDueDate, 7 * i);
      } else if (frequency === "biweekly") {
        dueDate = addCivilDays(firstDueDate, 15 * i);
      } else if (frequency === "monthly") {
        dueDate = addCivilMonthsClamped(firstDueDate, i, anchorDay);
      }
    }
    rows.push({
      sequence: i + 1,
      dueDate,
      amount: amounts[i]
    });
  }

  return rows;
}

export function sumScheduleAmounts(
  rows: StoreCreditInstallmentPreview[]
): number {
  return roundMoney(rows.reduce((acc, r) => acc + r.amount, 0));
}
