/**
 * Diagnóstico de service workers — sem unregister automático do OneSignal.
 * Workbox/PWA nunca é removido daqui.
 */

import {
  isCanonicalOneSignalRootWorkerScript,
  isDeprecatedSubdirOneSignalWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
} from "./oneSignalServiceWorkerPaths";

/**
 * Lista registros SW para diagnóstico (sem dados sensíveis).
 * Não desregistra nada.
 */
export async function listServiceWorkerRegistrationsForDiagnostics() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.getRegistrations) {
    return [];
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return (regs || []).map((reg) => {
      const scriptURL =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      let state = "unknown";
      if (reg.active) state = reg.active.state || "activated";
      else if (reg.waiting) state = "waiting";
      else if (reg.installing) state = "installing";
      return {
        scriptURL: String(scriptURL),
        scope: String(reg.scope || ""),
        state,
        active: Boolean(reg.active),
        waiting: Boolean(reg.waiting),
        installing: Boolean(reg.installing),
        onesignalRootCanonical: isCanonicalOneSignalRootWorkerScript(scriptURL),
        onesignalDeprecatedSubdir: isDeprecatedSubdirOneSignalWorkerScript(scriptURL),
        workboxOrPwa: isWorkboxOrPwaServiceWorkerScript(scriptURL),
      };
    });
  } catch {
    return [];
  }
}
