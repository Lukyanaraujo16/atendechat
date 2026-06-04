import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

/** Alinhado ao breakpoint `md` do Material-UI v4 (960px). */
export const MOBILE_MEDIA_QUERY = "(max-width:959.95px)";

/**
 * Verdadeiro em viewports abaixo de `md` (mesma regra de TicketResponsiveContainer / withWidth).
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
