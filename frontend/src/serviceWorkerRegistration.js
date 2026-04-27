/**
 * PWA mínimo quando OneSignal está desativado (Fase 1).
 * Não registar em paralelo com OneSignal no mesmo scope.
 */
export function registerMinimalPwaServiceWorker() {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined") {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    const swUrl = `${process.env.PUBLIC_URL || ""}/service-worker.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}
