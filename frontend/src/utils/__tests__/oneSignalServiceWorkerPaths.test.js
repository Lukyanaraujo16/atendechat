import {
  ONESIGNAL_SW_SCOPE_PATH,
  buildPublicAssetPath,
  detectBrowserLabel,
  getOneSignalServiceWorkerPath,
  getOneSignalServiceWorkerScope,
  getOneSignalServiceWorkerUpdaterPath,
  isLegacyOneSignalRootWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
  maskSubscriptionId,
} from "../oneSignalServiceWorkerPaths";
import { unregisterLegacyOneSignalRootWorkers } from "../oneSignalWorkerTransition";

describe("oneSignalServiceWorkerPaths", () => {
  it("monta paths isolados sem barras duplicadas", () => {
    expect(getOneSignalServiceWorkerPath("")).toBe(
      "/push/onesignal/OneSignalSDKWorker.js"
    );
    expect(getOneSignalServiceWorkerUpdaterPath("")).toBe(
      "/push/onesignal/OneSignalSDKUpdaterWorker.js"
    );
    expect(getOneSignalServiceWorkerScope("")).toBe(ONESIGNAL_SW_SCOPE_PATH);
    expect(getOneSignalServiceWorkerPath("/app")).toBe(
      "/app/push/onesignal/OneSignalSDKWorker.js"
    );
    expect(getOneSignalServiceWorkerScope("/app")).toBe("/app/push/onesignal/");
    expect(buildPublicAssetPath("push/onesignal/OneSignalSDKWorker.js", "/")).toBe(
      "/push/onesignal/OneSignalSDKWorker.js"
    );
  });

  it("Workbox fica no scope raiz; OneSignal não usa /", () => {
    expect(getOneSignalServiceWorkerScope("")).not.toBe("/");
    expect(getOneSignalServiceWorkerPath("")).not.toMatch(/^\/OneSignalSDKWorker\.js$/);
  });

  it("detecta worker OneSignal legado na raiz sem confundir o isolado", () => {
    expect(
      isLegacyOneSignalRootWorkerScript("https://app.example/OneSignalSDKWorker.js")
    ).toBe(true);
    expect(
      isLegacyOneSignalRootWorkerScript(
        "https://app.example/push/onesignal/OneSignalSDKWorker.js"
      )
    ).toBe(false);
    expect(
      isLegacyOneSignalRootWorkerScript("https://app.example/service-worker.js")
    ).toBe(false);
  });

  it("identifica Workbox/PWA e não o trata como legado OneSignal", () => {
    expect(
      isWorkboxOrPwaServiceWorkerScript("https://app.example/service-worker.js")
    ).toBe(true);
    expect(
      isLegacyOneSignalRootWorkerScript("https://app.example/service-worker.js")
    ).toBe(false);
  });

  it("mascara subscription id e detecta Firefox/Chrome", () => {
    expect(maskSubscriptionId("abcdefghijklmnop")).toMatch(/^abcdefgh…mnop$/);
    expect(detectBrowserLabel("Mozilla/5.0 Firefox/128.0")).toBe("Firefox");
    expect(
      detectBrowserLabel(
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
      )
    ).toBe("Chrome");
  });
});

describe("unregisterLegacyOneSignalRootWorkers", () => {
  const originalSW = navigator.serviceWorker;

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalSW,
    });
  });

  it("desregistra só OneSignal raiz e preserva Workbox", async () => {
    const unregisterLegacy = jest.fn(async () => true);
    const unregisterWorkbox = jest.fn(async () => true);
    const unregisterIsolated = jest.fn(async () => true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: async () => [
          {
            active: { scriptURL: "https://x/OneSignalSDKWorker.js", state: "activated" },
            scope: "https://x/",
            unregister: unregisterLegacy,
          },
          {
            active: { scriptURL: "https://x/service-worker.js", state: "activated" },
            scope: "https://x/",
            unregister: unregisterWorkbox,
          },
          {
            active: {
              scriptURL: "https://x/push/onesignal/OneSignalSDKWorker.js",
              state: "activated",
            },
            scope: "https://x/push/onesignal/",
            unregister: unregisterIsolated,
          },
        ],
      },
    });

    const summary = await unregisterLegacyOneSignalRootWorkers();
    expect(unregisterLegacy).toHaveBeenCalledTimes(1);
    expect(unregisterWorkbox).not.toHaveBeenCalled();
    expect(unregisterIsolated).not.toHaveBeenCalled();
    expect(summary.unregistered).toBe(1);
    expect(summary.skipped).toBe(2);
  });

  it("é idempotente quando não há legado", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: async () => [
          {
            active: { scriptURL: "https://x/service-worker.js", state: "activated" },
            scope: "https://x/",
            unregister: jest.fn(async () => true),
          },
        ],
      },
    });
    const summary = await unregisterLegacyOneSignalRootWorkers();
    expect(summary.unregistered).toBe(0);
    expect(summary.skipped).toBe(1);
  });
});
