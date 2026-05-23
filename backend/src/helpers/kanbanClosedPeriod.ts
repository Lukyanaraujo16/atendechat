import { Op } from "sequelize";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  startOfYear
} from "date-fns";

/** Períodos aceitos em `closedPeriod` (query Kanban). */
export type KanbanClosedPeriod =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "year"
  | "all";

const VALID: KanbanClosedPeriod[] = [
  "today",
  "7d",
  "30d",
  "month",
  "year",
  "all"
];

export function parseKanbanClosedPeriod(
  raw?: string | null
): KanbanClosedPeriod {
  if (raw && VALID.includes(raw as KanbanClosedPeriod)) {
    return raw as KanbanClosedPeriod;
  }
  return "today";
}

/**
 * Intervalo de `Ticket.updatedAt` para tickets `closed`.
 * Documentação: não há `closedAt` em Ticket; ao finalizar, o ticket é atualizado
 * e TicketTraking.finishedAt é preenchido — para o Kanban usamos `updatedAt`
 * do ticket em status closed (alinhado ao fechamento na maioria dos fluxos).
 */
export function buildClosedTicketUpdatedAtFilter(
  period: KanbanClosedPeriod
): { [Op.gte]: Date; [Op.lte]: Date } | null {
  const now = new Date();

  switch (period) {
    case "today":
      return {
        [Op.gte]: startOfDay(now),
        [Op.lte]: endOfDay(now)
      };
    case "7d":
      return {
        [Op.gte]: startOfDay(subDays(now, 6)),
        [Op.lte]: endOfDay(now)
      };
    case "30d":
      return {
        [Op.gte]: startOfDay(subDays(now, 29)),
        [Op.lte]: endOfDay(now)
      };
    case "month":
      return {
        [Op.gte]: startOfMonth(now),
        [Op.lte]: endOfDay(now)
      };
    case "year":
      return {
        [Op.gte]: startOfYear(now),
        [Op.lte]: endOfDay(now)
      };
    case "all":
      return null;
    default:
      return {
        [Op.gte]: startOfDay(now),
        [Op.lte]: endOfDay(now)
      };
  }
}

export function buildKanbanClosedStatusWhere(
  period: KanbanClosedPeriod
): { status: string; updatedAt?: { [Op.gte]: Date; [Op.lte]: Date } } {
  const range = buildClosedTicketUpdatedAtFilter(period);
  if (!range) {
    return { status: "closed" };
  }
  return { status: "closed", updatedAt: range };
}
