import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  startOfYear,
} from "date-fns";

export const KANBAN_CLOSED_PERIOD_STORAGE_KEY = "kanban.closedPeriod";

export const KANBAN_CLOSED_PERIOD_OPTIONS = [
  "today",
  "7d",
  "30d",
  "month",
  "year",
  "all",
];

const VALID = new Set(KANBAN_CLOSED_PERIOD_OPTIONS);

export function parseKanbanClosedPeriod(raw) {
  if (raw && VALID.has(raw)) return raw;
  return "today";
}

export function readKanbanClosedPeriodFromStorage() {
  try {
    return parseKanbanClosedPeriod(
      localStorage.getItem(KANBAN_CLOSED_PERIOD_STORAGE_KEY)
    );
  } catch {
    return "today";
  }
}

export function writeKanbanClosedPeriodToStorage(period) {
  try {
    localStorage.setItem(
      KANBAN_CLOSED_PERIOD_STORAGE_KEY,
      parseKanbanClosedPeriod(period)
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns {{ start: Date, end: Date } | null} null = sem filtro (todos) */
export function getKanbanClosedPeriodRange(period, now = new Date()) {
  const p = parseKanbanClosedPeriod(period);

  switch (p) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "year":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "all":
      return null;
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function ticketMatchesKanbanClosedPeriod(ticket, period) {
  if (!ticket || ticket.status !== "closed") return true;
  const range = getKanbanClosedPeriodRange(period);
  if (!range) return true;
  if (!ticket.updatedAt) return false;
  const at = new Date(ticket.updatedAt);
  return at >= range.start && at <= range.end;
}
