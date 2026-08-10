/**
 * Viewport visual mobile (iOS/PWA/Android) — altura útil e teclado.
 * Funções puras exportadas para testes; o hook só assina listeners.
 */

export const KEYBOARD_OPEN_THRESHOLD_PX = 120;

/**
 * @param {object} [env]
 * @param {number} [env.visualHeight]
 * @param {number} [env.layoutHeight]
 * @param {number} [env.offsetTop]
 * @param {number} [env.offsetLeft]
 * @param {boolean} [env.hasVisualViewport]
 */
export function readMobileVisualViewport(env) {
  if (typeof window === "undefined" && !env) {
    return {
      height: 0,
      offsetTop: 0,
      offsetLeft: 0,
      layoutHeight: 0,
      hasVisualViewport: false,
      keyboardLikelyOpen: false,
      bottomInset: 0,
    };
  }

  if (env) {
    const layoutHeight = Number(env.layoutHeight) || 0;
    const visualHeight = Number(env.visualHeight) || layoutHeight;
    const offsetTop = Number(env.offsetTop) || 0;
    const offsetLeft = Number(env.offsetLeft) || 0;
    const hasVisualViewport = Boolean(env.hasVisualViewport);
    const bottomInset = Math.max(0, layoutHeight - visualHeight - offsetTop);
    const keyboardLikelyOpen = bottomInset >= KEYBOARD_OPEN_THRESHOLD_PX;
    return {
      height: visualHeight,
      offsetTop,
      offsetLeft,
      layoutHeight,
      hasVisualViewport,
      keyboardLikelyOpen,
      bottomInset,
    };
  }

  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight || 0;
  if (vv) {
    const bottomInset = Math.max(0, layoutHeight - vv.height - vv.offsetTop);
    return {
      height: vv.height,
      offsetTop: vv.offsetTop || 0,
      offsetLeft: vv.offsetLeft || 0,
      layoutHeight,
      hasVisualViewport: true,
      keyboardLikelyOpen: bottomInset >= KEYBOARD_OPEN_THRESHOLD_PX,
      bottomInset,
    };
  }

  return {
    height: layoutHeight,
    offsetTop: 0,
    offsetLeft: 0,
    layoutHeight,
    hasVisualViewport: false,
    keyboardLikelyOpen: false,
    bottomInset: 0,
  };
}

export function viewportStatesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.height === b.height &&
    a.offsetTop === b.offsetTop &&
    a.offsetLeft === b.offsetLeft &&
    a.keyboardLikelyOpen === b.keyboardLikelyOpen &&
    a.bottomInset === b.bottomInset
  );
}

export const TICKET_CONVERSATION_MOBILE_CLASS = "shc-ticket-conversation-mobile";
export const TICKET_KEYBOARD_OPEN_CLASS = "shc-ticket-keyboard-open";

/**
 * Aplica CSS vars / classes no documentElement (sem dados sensíveis).
 */
export function applyMobileVisualViewportToDocument(state, { active = true } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!active) {
    root.classList.remove(TICKET_CONVERSATION_MOBILE_CLASS);
    root.classList.remove(TICKET_KEYBOARD_OPEN_CLASS);
    root.removeAttribute("data-app-vv-height");
    root.removeAttribute("data-app-vv-offset-top");
    root.removeAttribute("data-app-vv-bottom-inset");
    try {
      root.style.removeProperty("--app-vv-height");
      root.style.removeProperty("--app-vv-offset-top");
      root.style.removeProperty("--app-vv-bottom-inset");
    } catch {
      /* ignore */
    }
    return;
  }

  root.classList.add(TICKET_CONVERSATION_MOBILE_CLASS);
  if (state.keyboardLikelyOpen) {
    root.classList.add(TICKET_KEYBOARD_OPEN_CLASS);
  } else {
    root.classList.remove(TICKET_KEYBOARD_OPEN_CLASS);
  }

  const heightPx = state.height > 0 ? `${Math.round(state.height)}px` : "";
  const offsetPx = `${Math.round(state.offsetTop || 0)}px`;
  const insetPx = `${Math.round(state.bottomInset || 0)}px`;

  if (heightPx) {
    root.setAttribute("data-app-vv-height", heightPx);
    try {
      root.style.setProperty("--app-vv-height", heightPx);
    } catch {
      /* ignore */
    }
  }
  root.setAttribute("data-app-vv-offset-top", offsetPx);
  root.setAttribute("data-app-vv-bottom-inset", insetPx);
  try {
    root.style.setProperty("--app-vv-offset-top", offsetPx);
    root.style.setProperty("--app-vv-bottom-inset", insetPx);
  } catch {
    /* ignore */
  }
}
