/**
 * Substitui o Workbox gerado pelo CRA por um SW "kill-switch".
 * Clientes com SW antigo em /service-worker.js passam a desinstalar
 * precache e se desregistrar — sem afetar OneSignal (/OneSignalSDK*.js).
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const swPath = path.join(buildDir, "service-worker.js");

const KILL_SWITCH = `/**
 * StreamHUB Chat — service worker kill-switch (anti-stale Workbox).
 * Não faz precache. Limpa caches do app e desregistra a si mesmo.
 * OneSignal permanece em OneSignalSDKWorker.js (outro script/scope).
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
`;

if (!fs.existsSync(buildDir)) {
  console.warn("[replace-service-worker-killswitch] build/ ausente — ignore.");
  process.exit(0);
}

fs.writeFileSync(swPath, KILL_SWITCH, "utf8");
console.log(`[replace-service-worker-killswitch] wrote ${swPath}`);

// Remove precache manifests órfãos (não usados pelo kill-switch).
try {
  for (const name of fs.readdirSync(buildDir)) {
    if (name.startsWith("precache-manifest.") && name.endsWith(".js")) {
      fs.unlinkSync(path.join(buildDir, name));
      console.log(`[replace-service-worker-killswitch] removed ${name}`);
    }
  }
} catch (e) {
  // ignore
}
