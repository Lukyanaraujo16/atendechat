import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

/**
 * Breakpoint de experiência mobile do ticket = `breakpoints.down("md")`.
 * Tema MUI v4 padrão: md=960 → down("md") = max-width 1279.95px.
 * (Não confundir com down("sm") = 959.95px.)
 */
export const MOBILE_MEDIA_QUERY = "(max-width:1279.95px)";

/**
 * Verdadeiro em viewports abaixo de `lg` via `down("md")`
 * (mesma regra de TicketResponsiveContainer / TicketsAdvanced).
 */
export default function useIsMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("md"));
}

export function useBreakpoint() {
  const isMobile = useIsMobile();
  return {
    isMobile,
    isDesktop: !isMobile,
    downMd: isMobile,
    upMd: !isMobile,
  };
}
