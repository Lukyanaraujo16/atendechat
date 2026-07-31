/**
 * PWA/Workbox no scope `/` (produção).
 *
 * Após isolamento OneSignal em `/push/onesignal/`, este registro pode coexistir
 * com o worker OneSignal. O build do react-scripts gera Workbox real em
 * `build/service-worker.js` (não o arquivo mínimo de `public/`).
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
