/**
 * Desktop split da inbox (TicketsCustom), independente de `useIsMobile`.
 *
 * A: <= 1279.95px → TicketsAdvanced (master/detail).
 * B: 1280px – 1599.95px → densidade visual compacta (pills/cards).
 * C: >= 1600px → densidade visual larga.
 *
 * Geometria da lista/conversa: regra única contínua em todo o desktop split.
 */

import { MODULE_TABS_HORIZONTAL_PADDING_PX } from "../layout/layoutConstants";

export const TICKETS_DESKTOP_MIN_WIDTH = 1280;

/** Limite superior inclusivo da faixa de densidade compacta (cards/pills). */
export const TICKETS_COMPACT_DESKTOP_MAX_WIDTH = 1599.95;

export const TICKETS_WIDE_DESKTOP_MIN_WIDTH = 1600;

export const TICKETS_LIST_MIN_PX = 420;
export const TICKETS_LIST_MAX_PX = 520;
export const TICKETS_LIST_FRACTION = 0.4;

export const TICKETS_COMPACT_DESKTOP_MEDIA = `(min-width: ${TICKETS_DESKTOP_MIN_WIDTH}px) and (max-width: ${TICKETS_COMPACT_DESKTOP_MAX_WIDTH}px)`;

/** Desktop split (TicketsCustom): >=1280, independente da largura da lista (máx. 520px). */
export const TICKETS_DESKTOP_SPLIT_MEDIA = `(min-width: ${TICKETS_DESKTOP_MIN_WIDTH}px)`;

/** Colunas do split em todo o desktop (>= 1280): monotônicas ao redimensionar. */
export const TICKETS_DESKTOP_SPLIT_COLUMNS = `clamp(${TICKETS_LIST_MIN_PX}px, 40%, ${TICKETS_LIST_MAX_PX}px) minmax(0, 1fr)`;

/** Abaixo desta largura útil da conversa, ações secundárias vão para ⋮ (drawer aberto). */
export const TICKETS_CONVERSATION_OVERFLOW_MAX_PX = 900;

/** Estimativas para testes (alinhadas ao layout/index.js). */
export const DRAWER_WIDTH_OPEN_PX = 299;
export const DRAWER_WIDTH_COLLAPSED_PX = 72;
/** TicketsCustom `chatContainer`: theme.spacing(1) × 2 (horizontal total). */
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
  return Math.max(
    0,
    viewportWidth -
      drawer -
      MODULE_TABS_HORIZONTAL_PADDING_PX -
      TICKETS_CHAT_CONTAINER_PADDING_PX
  );
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
 * Largura útil da coluna da conversa no split desktop.
 * @param {number} viewportWidth
 * @param {{ drawerOpen?: boolean }} [options]
 */
export function estimateConversationColumnWidth(
  viewportWidth,
  { drawerOpen = true } = {}
) {
  const splitW = estimateSplitContentWidth(viewportWidth, { drawerOpen });
  const listW = estimateTicketsListColumnWidth(splitW);
  return Math.max(0, splitW - TICKETS_SPLIT_GRID_GAP_PX - listW);
}

/**
 * Desktop split com conversa estreita → menu ⋮ para ações secundárias.
 * @param {number} viewportWidth
 * @param {{ drawerOpen?: boolean }} [options]
 */
export function shouldUseDesktopConversationOverflow(
  viewportWidth,
  { drawerOpen = true } = {}
) {
  if (viewportWidth < TICKETS_DESKTOP_MIN_WIDTH) {
    return false;
  }
  return (
    estimateConversationColumnWidth(viewportWidth, { drawerOpen }) <
    TICKETS_CONVERSATION_OVERFLOW_MAX_PX
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
