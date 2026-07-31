/**
 * PWA/Workbox no scope `/` (produção).
 *
 * OneSignal usa script na raiz com scope `/push/onesignal/` — coexistência sem
 * disputa pelo controlador da raiz. O build do react-scripts gera Workbox real
 * em `build/service-worker.js`.
 *
 * Não desregistrar workers OneSignal daqui.
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
