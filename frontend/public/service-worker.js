/**
 * Service worker mínimo (Fase 1 PWA).
 *
 * - Não intercepta nem cacheia `fetch` — o browser mantém o comportamento normal de rede.
 *   • Isto inclui favicons e ficheiros em `/public/branding/` (ícone da aba vem de <link rel="icon">).
 * - Não armazena dados sensíveis.
 * - Atualização: novo deploy substitui este ficheiro; o browser deteta e ativa nova versão.
 *
 * CACHE_VERSION: incrementar em deploy se for necessário forçar reciclagem de SW antigo nos clientes.
 *
 * OneSignal / SW único: evite dois service workers no mesmo scope; ver documentação do plugin.
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
