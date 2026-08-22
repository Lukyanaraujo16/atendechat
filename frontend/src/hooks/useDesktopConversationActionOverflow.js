import { useEffect, useState } from "react";

import useIsMobile from "./useIsMobile";
import { useMainDrawerOpen } from "../context/MainDrawerLayout/MainDrawerLayoutContext";
import {
  TICKETS_DESKTOP_MIN_WIDTH,
  shouldUseDesktopConversationOverflow,
} from "../utils/ticketsCompactDesktopLayout";

/**
 * Desktop split com coluna de conversa estreita → overflow ⋮ (não é `useIsMobile`).
 */
export default function useDesktopConversationActionOverflow() {
  const isMobile = useIsMobile();
  const drawerOpen = useMainDrawerOpen();
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : TICKETS_DESKTOP_MIN_WIDTH
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (isMobile) {
    return false;
  }

  return shouldUseDesktopConversationOverflow(viewportWidth, { drawerOpen });
}
