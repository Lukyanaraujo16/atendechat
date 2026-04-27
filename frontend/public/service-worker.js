/**
 * Service worker mínimo (Fase 1 PWA).
 *
 * - Não usa cache de fetch: todas as requisições seguem o comportamento normal da rede.
 * - Não armazena dados sensíveis.
 * - Atualização: novo deploy substitui este ficheiro; o browser deteta e ativa nova versão.
 *
 * Fase OneSignal (seguinte):
 * - A documentação OneSignal para Web costuma usar um ficheiro raiz `OneSignalSDKWorker.js`
 *   que faz `importScripts("https://cdn.onesignal.com/...")` e pode importar também este ficheiro
 *   ou fundir a lógica. Evite dois registos independentes de SW no mesmo scope.
 * - Planear um único SW de entrada (ex.: `OneSignalSDKWorker.js`) que importe o SDK e, se necessário,
 *   `importScripts("./service-worker-base.js")` com os listeners abaixo.
 */
/* eslint-disable no-restricted-globals */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
