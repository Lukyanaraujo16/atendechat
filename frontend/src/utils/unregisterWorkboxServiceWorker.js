/**
 * Remove Service Worker Workbox/PWA do scope `/` com segurança.
 * Nunca desregistra workers OneSignal.
 */

import { isWorkboxOrPwaServiceWorkerScript } from "./oneSignalServiceWorkerPaths";

/**
 * Caches do CRA/Workbox/PWA do app — nunca caches genéricos de terceiros.
 * Evita filtro amplo como "runtime" sozinho.
 */
export function isAppOwnedCacheName(name) {
  return /workbox|precache|cra-v|streamhub-chat|atendechat/i.test(
    String(name || "")
  );
}

export async function clearAppOwnedCaches(
  cacheApi = typeof caches !== "undefined" ? caches : null
) {
  if (!cacheApi?.keys) return { deleted: [] };
  try {
    const keys = await cacheApi.keys();
    const deleted = [];
    await Promise.all(
      keys.map(async (key) => {
        if (isAppOwnedCacheName(key)) {
          const ok = await cacheApi.delete(key);
          if (ok) deleted.push(key);
        }
      })
    );
    return { deleted };
  } catch {
    return { deleted: [] };
  }
}

export async function unregisterWorkboxServiceWorkers(
  serviceWorkerContainer = typeof navigator !== "undefined"
    ? navigator.serviceWorker
    : null
) {
  if (!serviceWorkerContainer?.getRegistrations) {
    return { unregistered: 0, clearedCaches: [] };
  }
  let unregistered = 0;
  try {
    const regs = await serviceWorkerContainer.getRegistrations();
    await Promise.all(
      (regs || []).map(async (reg) => {
        const scriptURL =
          reg.active?.scriptURL ||
          reg.waiting?.scriptURL ||
          reg.installing?.scriptURL ||
          "";
        if (!isWorkboxOrPwaServiceWorkerScript(scriptURL)) {
          return;
        }
        try {
          const ok = await reg.unregister();
          if (ok) unregistered += 1;
        } catch {
          // ignore
        }
      })
    );
  } catch {
    // ignore
  }
  const { deleted } = await clearAppOwnedCaches();
  return { unregistered, clearedCaches: deleted };
}

/**
 * Bootstrap: para de registrar Workbox e limpa SW antigo.
 * OneSignal permanece intacto.
 */
export function bootstrapDisableWorkboxServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const run = () => {
    unregisterWorkboxServiceWorkers().catch(() => undefined);
  };
  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}
