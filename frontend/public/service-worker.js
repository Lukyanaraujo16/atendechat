/**
 * Service worker mínimo de referência em `public/` (Fase 1 PWA).
 *
 * ATENÇÃO: o `react-scripts build` gera Workbox real em `build/service-worker.js`,
 * que sobrescreve este ficheiro no artefacto de produção. Scope típico: `/`.
 *
 * OneSignal usa scope isolado `/push/onesignal/` — os dois podem coexistir.
 */
/* eslint-disable no-restricted-globals */
// eslint-disable-next-line no-unused-vars
const CACHE_VERSION = "2026-04-22-branding-favicon";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
