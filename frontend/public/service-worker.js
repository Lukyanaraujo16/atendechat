/**
 * Service worker mínimo em public/ — sobrescrito no build pelo kill-switch.
 * Em produção o artefacto final não faz precache (ver replace-service-worker-killswitch.js).
 */
/* eslint-disable no-restricted-globals */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch (e) {
        // ignore
      }
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) =>
              /workbox|precache|cra-v|streamhub-chat|atendechat/i.test(String(k))
            )
            .map((k) => caches.delete(k))
        );
      } catch (e) {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }
    })()
  );
});
