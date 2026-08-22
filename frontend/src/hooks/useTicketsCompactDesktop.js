import useMediaQuery from "@material-ui/core/useMediaQuery";

import { TICKETS_COMPACT_DESKTOP_MEDIA } from "../utils/ticketsCompactDesktopLayout";

/**
 * True na faixa 1280–1599.95px (desktop compacto da inbox).
 * Não altera nem substitui `useIsMobile`.
 */
export default function useTicketsCompactDesktop() {
  return useMediaQuery(TICKETS_COMPACT_DESKTOP_MEDIA);
}
