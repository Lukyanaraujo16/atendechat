import { alpha } from "@material-ui/core/styles";

export const PANEL_RADIUS = 14;
/** Radius do painel esquerdo: ambos os cantos superiores arredondados; base reta à direita. */
export const INBOX_LIST_PANEL_RADIUS = `${PANEL_RADIUS}px ${PANEL_RADIUS}px 0 ${PANEL_RADIUS}px`;
export const PANEL_GAP_PX = 12;
/** Padding lateral padrão da coluna de lista (busca, bulk, cards). */
export const LIST_SIDE_PADDING_PX = 12;

/** Cor de borda ultra sutil (preferir superfície em vez de stroke forte). */
export function getSubtleBorderColor(theme) {
  return theme.palette.type === "dark"
    ? "rgba(255,255,255,0.07)"
    : "rgba(0,0,0,0.06)";
}

/** Borda 1px sutil para divisores horizontais/verticais. */
export function getSubtleBorder(theme) {
  return `1px solid ${getSubtleBorderColor(theme)}`;
}

/** Superfície da coluna de lista (fundo recuado). */
export function getInboxListSurface(theme) {
  return theme.palette.type === "dark" ? "#161616" : "#F6F7F8";
}

/** Superfície de card/item na lista. */
export function getInboxCardSurface(theme) {
  return theme.palette.type === "dark" ? "#191919" : "#FFFFFF";
}

/** Superfície de card em hover. */
export function getInboxCardSurfaceHover(theme) {
  return theme.palette.type === "dark" ? "#1D1D1D" : "#FAFAFA";
}

/** Header da conversa aberta. */
export function getChatHeaderSurface(theme) {
  return theme.palette.type === "dark" ? "#191919" : "#FFFFFF";
}

/** Área de mensagens (fundo do chat). */
export function getChatBodySurface(theme) {
  return theme.palette.type === "dark" ? "#161616" : "#F6F7F8";
}

/** Composer / rodapé de input. */
export function getComposerSurface(theme) {
  return theme.palette.type === "dark" ? "#191919" : "#FFFFFF";
}

/** Sombra leve para cards da lista. */
export function getCardElevation(theme) {
  return theme.palette.type === "dark"
    ? "0 1px 2px rgba(0,0,0,0.18)"
    : "0 1px 3px rgba(0,0,0,0.05)";
}

/** Sombra leve em hover (elevação discreta). */
export function getCardElevationHover(theme) {
  return theme.palette.type === "dark"
    ? "0 2px 6px rgba(0,0,0,0.28)"
    : "0 2px 8px rgba(0,0,0,0.08)";
}

/** Realce do card selecionado — fundo + borda mínima, sem contorno grosso. */
export function getCardSelectedBackground(theme) {
  const isDark = theme.palette.type === "dark";
  return isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.14)}, ${alpha(theme.palette.success.main, 0.06)})`
    : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.11)}, ${alpha(theme.palette.success.main, 0.04)})`;
}

export function getCardSelectedBorder(theme) {
  return `1px solid ${alpha(
    theme.palette.success.main,
    theme.palette.type === "dark" ? 0.2 : 0.16
  )}`;
}

export function getCardSelectedShadow(theme) {
  const isDark = theme.palette.type === "dark";
  return isDark
    ? `0 1px 3px rgba(0,0,0,0.22), 0 0 0 1px ${alpha(theme.palette.success.main, 0.1)}`
    : `0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px ${alpha(theme.palette.success.main, 0.08)}`;
}

/** Divisor superior do composer (sem borda pesada). */
export function getComposerTopDivider(theme) {
  return theme.palette.type === "dark"
    ? "0 -1px 0 rgba(255,255,255,0.06)"
    : "0 -1px 0 rgba(0,0,0,0.06)";
}

/** Sombra padrão dos painéis principais (lista + conversa). */
export function getPanelElevation(theme) {
  return theme.palette.type === "dark"
    ? "0 1px 2px rgba(0,0,0,0.3), 0 6px 18px rgba(0,0,0,0.4)"
    : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)";
}

/** Divisão sutil entre lista e conversa (aplicar em um lado apenas). */
export function getPanelDividerBorder(theme) {
  return getSubtleBorder(theme);
}

/** Gradiente ultra sutil no painel da conversa. */
export function getChatPanelBackground(theme) {
  return getChatHeaderSurface(theme);
}

/** Scrollbar discreta para listas de tickets. */
export function getTicketPanelScrollbarStyles(theme) {
  return {
    "&::-webkit-scrollbar": {
      width: 6,
      height: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: alpha(theme.palette.text.primary, 0.2),
      borderRadius: 10,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
  };
}

export function getCardListHoverBackground(theme) {
  return getInboxCardSurfaceHover(theme);
}
