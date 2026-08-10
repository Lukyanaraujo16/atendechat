import { useEffect, useRef, useState } from "react";
import {
  applyMobileVisualViewportToDocument,
  readMobileVisualViewport,
  viewportStatesEqual,
} from "../utils/mobileVisualViewport";

/**
 * Observa visualViewport (com fallback) para a conversa mobile.
 * Um único par de listeners; não re-renderiza se o estado for equivalente.
 *
 * @param {{ enabled?: boolean }} [options]
 */
export default function useMobileVisualViewport({ enabled = true } = {}) {
  const [state, setState] = useState(() =>
    enabled ? readMobileVisualViewport() : readMobileVisualViewport({
      visualHeight: 0,
      layoutHeight: 0,
      offsetTop: 0,
      offsetLeft: 0,
      hasVisualViewport: false,
    })
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      applyMobileVisualViewportToDocument(stateRef.current, { active: false });
      return undefined;
    }

    let raf = 0;
    const publish = () => {
      raf = 0;
      const next = readMobileVisualViewport();
      if (viewportStatesEqual(stateRef.current, next)) {
        applyMobileVisualViewportToDocument(next, { active: true });
        return;
      }
      stateRef.current = next;
      setState(next);
      applyMobileVisualViewportToDocument(next, { active: true });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(publish);
    };

    publish();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    window.addEventListener("resize", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      applyMobileVisualViewportToDocument(stateRef.current, { active: false });
    };
  }, [enabled]);

  return state;
}
