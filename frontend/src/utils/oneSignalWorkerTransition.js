/**
 * Transição segura: remove apenas registros OneSignal legados na raiz (scope /).
 * Nunca desregistra Workbox/PWA (/service-worker.js) nem workers de outros scopes.
 */

import {
  isLegacyOneSignalRootWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
} from "./oneSignalServiceWorkerPaths";

/**
 * @returns {Promise<{ unregistered: number, skipped: number, errors: number }>}
 */
export async function unregisterLegacyOneSignalRootWorkers() {
  const summary = { unregistered: 0, skipped: 0, errors: 0 };
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.getRegistrations) {
    return summary;
  }
  let registrations;
  try {
    registrations = await navigator.serviceWorker.getRegistrations();
  } catch {
    summary.errors += 1;
    return summary;
  }

  await Promise.all(
    (registrations || []).map(async (reg) => {
      const scriptURL =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      if (isWorkboxOrPwaServiceWorkerScript(scriptURL)) {
        summary.skipped += 1;
        return;
      }
      if (!isLegacyOneSignalRootWorkerScript(scriptURL)) {
        summary.skipped += 1;
        return;
      }
      try {
        const ok = await reg.unregister();
        if (ok) summary.unregistered += 1;
        else summary.skipped += 1;
      } catch {
        summary.errors += 1;
      }
    })
  );

  return summary;
}

/**
 * Lista registros SW para diagnóstico (sem dados sensíveis).
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
        legacyOneSignalRoot: isLegacyOneSignalRootWorkerScript(scriptURL),
        workboxOrPwa: isWorkboxOrPwaServiceWorkerScript(scriptURL),
      };
    });
  } catch {
    return [];
  }
}
