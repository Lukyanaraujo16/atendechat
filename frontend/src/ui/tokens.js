/**
 * Design tokens da aplicação (valores semânticos alinhados ao tema em App.js).
 * Use com theme.spacing / palette quando estiver dentro de makeStyles/useTheme.
 *
 * @see App.js — createTheme (tipografia Montserrat, primary #24c776, shape.borderRadius 10)
 */

/** Espaçamento entre secções de página (px lógicos via theme.spacing) */
export const SECTION_GAP_UNITS = 2;

/** Padding interno típico de cards de listagem */
export const CARD_PADDING_UNITS = 2;

/** Raio de canto “card” — alinhado a theme.shape.borderRadius (10) e Paper.rounded (18 no override) */
export const CARD_RADIUS_REF = "theme.shape.borderRadius"; // 10

/** Gap entre grupos na barra de ações (ex.: TicketConversationActionBar) */
export const ACTION_GROUP_GAP_UNITS = 2;

/**
 * Chaves de paleta custom usadas no projeto (App.js palette).
 * Preferir migrar gradualmente para palette.semantic.* quando unificado.
 */
export const LEGACY_PALETTE_KEYS = [
  "tabHeaderBackground",
  "bordabox",
  "newmessagebox",
  "fancyBackground",
  "chatlist",
  "boxticket",
  "campaigntab",
];
