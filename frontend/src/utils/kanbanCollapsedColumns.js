export const KANBAN_COLLAPSED_COLUMNS_STORAGE_KEY = "kanban.collapsedColumns";

const COLUMN_KEYS = ["pending", "open", "closed"];

export const KANBAN_COLUMN_KEYS = COLUMN_KEYS;

function normalizeCollapsedState(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    pending: Boolean(raw.pending),
    open: Boolean(raw.open),
    closed: Boolean(raw.closed),
  };
}

export function readKanbanCollapsedColumnsFromStorage() {
  try {
    const raw = localStorage.getItem(KANBAN_COLLAPSED_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeCollapsedState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeKanbanCollapsedColumnsToStorage(state) {
  try {
    localStorage.setItem(
      KANBAN_COLLAPSED_COLUMNS_STORAGE_KEY,
      JSON.stringify({
        pending: Boolean(state.pending),
        open: Boolean(state.open),
        closed: Boolean(state.closed),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function getInitialKanbanCollapsedColumns() {
  const saved = readKanbanCollapsedColumnsFromStorage();
  if (saved) return saved;
  return {
    pending: false,
    open: false,
    closed: false,
  };
}

/**
 * Sem preferência salva: em telas grandes, recolhe Finalizado só se count > 50.
 * Em telas menores, mantém expandido (mais seguro).
 */
export function shouldDefaultCollapseClosedColumn(closedCount) {
  if (typeof window === "undefined") return false;
  const count = Number(closedCount) || 0;
  if (count <= 50) return false;
  try {
    return window.matchMedia("(min-width: 900px)").matches;
  } catch {
    return false;
  }
}

export function hasKanbanCollapsedColumnsPreference() {
  return readKanbanCollapsedColumnsFromStorage() != null;
}
