export const KANBAN_COLUMN_PAGE_SIZE = 30;

export const KANBAN_COLUMN_KEYS = ["pending", "open", "closed"];

export function getInitialKanbanVisibleLimits(
  pageSize = KANBAN_COLUMN_PAGE_SIZE
) {
  return {
    pending: pageSize,
    open: pageSize,
    closed: pageSize,
  };
}

export function sliceTicketsForColumn(tickets, visibleLimit) {
  const list = Array.isArray(tickets) ? tickets : [];
  const limit = Math.max(0, Number(visibleLimit) || 0);
  const safeLimit = limit > 0 ? limit : KANBAN_COLUMN_PAGE_SIZE;
  return list.slice(0, Math.min(safeLimit, list.length));
}

export function getColumnVisibleMeta(tickets, visibleLimit) {
  const total = Array.isArray(tickets) ? tickets.length : 0;
  const visible = sliceTicketsForColumn(tickets, visibleLimit);
  return {
    total,
    visibleCount: visible.length,
    visibleTickets: visible,
    hasMore: total > visible.length,
  };
}

export function nextVisibleLimit(currentLimit, total, step = KANBAN_COLUMN_PAGE_SIZE) {
  const current = Math.max(0, Number(currentLimit) || 0);
  const max = Math.max(0, Number(total) || 0);
  if (current >= max) return current;
  return Math.min(current + step, max);
}
