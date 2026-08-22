/**
 * Desktop split da inbox (TicketsCustom), independente de `useIsMobile`.
 *
 * A: <= 1279.95px → TicketsAdvanced (master/detail).
 * B: 1280px – 1599.95px → densidade visual compacta (pills/cards).
 * C: >= 1600px → densidade visual larga.
 *
 * Geometria da lista/conversa: regra única contínua em todo o desktop split.
 */

export const TICKETS_DESKTOP_MIN_WIDTH = 1280;

/** Limite superior inclusivo da faixa de densidade compacta (cards/pills). */
export const TICKETS_COMPACT_DESKTOP_MAX_WIDTH = 1599.95;

export const TICKETS_WIDE_DESKTOP_MIN_WIDTH = 1600;

export const TICKETS_LIST_MIN_PX = 420;
export const TICKETS_LIST_MAX_PX = 520;
export const TICKETS_LIST_FRACTION = 0.4;

export const TICKETS_COMPACT_DESKTOP_MEDIA = `(min-width: ${TICKETS_DESKTOP_MIN_WIDTH}px) and (max-width: ${TICKETS_COMPACT_DESKTOP_MAX_WIDTH}px)`;

/** Colunas do split em todo o desktop (>= 1280): monotônicas ao redimensionar. */
export const TICKETS_DESKTOP_SPLIT_COLUMNS = `clamp(${TICKETS_LIST_MIN_PX}px, 40%, ${TICKETS_LIST_MAX_PX}px) minmax(0, 1fr)`;

/** Estimativas para testes (alinhadas ao layout/index.js). */
export const DRAWER_WIDTH_OPEN_PX = 299;
export const DRAWER_WIDTH_COLLAPSED_PX = 72;
export const TICKETS_CHAT_CONTAINER_PADDING_PX = 16;
export const TICKETS_SPLIT_GRID_GAP_PX = 12;

/**
 * Largura útil do grid split (área dentro do padding do chatContainer).
 * @param {number} viewportWidth
 * @param {{ drawerOpen?: boolean }} [options]
 */
export function estimateSplitContentWidth(
  viewportWidth,
  { drawerOpen = true } = {}
) {
  const drawer = drawerOpen ? DRAWER_WIDTH_OPEN_PX : DRAWER_WIDTH_COLLAPSED_PX;
  return Math.max(0, viewportWidth - drawer - TICKETS_CHAT_CONTAINER_PADDING_PX);
}

/**
 * Largura da coluna da lista (equivalente a clamp(420px, 40%, 520px)).
 * @param {number} splitContentWidth
 */
export function estimateTicketsListColumnWidth(splitContentWidth) {
  const preferred = splitContentWidth * TICKETS_LIST_FRACTION;
  return Math.min(
    TICKETS_LIST_MAX_PX,
    Math.max(TICKETS_LIST_MIN_PX, preferred)
  );
}

/**
 * Contador das pills da inbox: exibe até 999; acima mostra 99+ (valor real em title/aria).
 * @param {number} count
 * @returns {{ display: string, exact: number }}
 */
export function formatInboxPillCount(count) {
  const exact = Math.max(0, Math.floor(Number(count) || 0));
  if (exact > 999) {
    return { display: "999+", exact };
  }
  return { display: String(exact), exact };
}
