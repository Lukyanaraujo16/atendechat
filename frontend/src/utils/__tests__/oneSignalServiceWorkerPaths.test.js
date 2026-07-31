import {
  ONESIGNAL_SW_SCOPE_PATH,
  buildPublicAssetPath,
  detectBrowserLabel,
  getOneSignalServiceWorkerPath,
  getOneSignalServiceWorkerScope,
  getOneSignalServiceWorkerUpdaterPath,
  isCanonicalOneSignalRootWorkerScript,
  isDeprecatedSubdirOneSignalWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
  maskSubscriptionId,
} from "../oneSignalServiceWorkerPaths";
import { listServiceWorkerRegistrationsForDiagnostics } from "../oneSignalWorkerTransition";

describe("oneSignalServiceWorkerPaths (2.13C)", () => {
  it("mantém worker OneSignal na URL histórica da raiz", () => {
    expect(getOneSignalServiceWorkerPath("")).toBe("/OneSignalSDKWorker.js");
    expect(getOneSignalServiceWorkerUpdaterPath("")).toBe(
      "/OneSignalSDKUpdaterWorker.js"
    );
    expect(getOneSignalServiceWorkerPath("/app")).toBe("/app/OneSignalSDKWorker.js");
  });

  it("usa scope isolado /push/onesignal/ sem path canónico no subdiretório", () => {
    expect(getOneSignalServiceWorkerScope("")).toBe(ONESIGNAL_SW_SCOPE_PATH);
    expect(getOneSignalServiceWorkerScope("")).not.toBe("/");
    expect(getOneSignalServiceWorkerPath("")).not.toContain("/push/onesignal/");
    expect(getOneSignalServiceWorkerScope("/app")).toBe("/app/push/onesignal/");
    expect(buildPublicAssetPath("OneSignalSDKWorker.js", "")).toBe(
      "/OneSignalSDKWorker.js"
    );
  });

  it("Workbox permanece identificável no scope raiz", () => {
    expect(
      isWorkboxOrPwaServiceWorkerScript("https://app.example/service-worker.js")
    ).toBe(true);
    expect(
      isCanonicalOneSignalRootWorkerScript("https://app.example/service-worker.js")
    ).toBe(false);
  });

  it("identifica script raiz canónico e subdir deprecado da 2.13B", () => {
    expect(
      isCanonicalOneSignalRootWorkerScript("https://x/OneSignalSDKWorker.js")
    ).toBe(true);
    expect(
      isDeprecatedSubdirOneSignalWorkerScript(
        "https://x/push/onesignal/OneSignalSDKWorker.js"
      )
    ).toBe(true);
    expect(
      isCanonicalOneSignalRootWorkerScript(
        "https://x/push/onesignal/OneSignalSDKWorker.js"
      )
    ).toBe(false);
  });

  it("mascara subscription e detecta Firefox/Chrome", () => {
    expect(maskSubscriptionId("abcdefghijklmnop")).toMatch(/^abcdefgh…mnop$/);
    expect(detectBrowserLabel("Mozilla/5.0 Firefox/128.0")).toBe("Firefox");
    expect(
      detectBrowserLabel(
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
      )
    ).toBe("Chrome");
  });
});

describe("oneSignalWorkerTransition (sem unregister)", () => {
  const originalSW = navigator.serviceWorker;

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalSW,
    });
  });

  it("lista workers para diagnóstico sem desregistrar", async () => {
    const unregister = jest.fn(async () => true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: async () => [
          {
            active: { scriptURL: "https://x/OneSignalSDKWorker.js", state: "activated" },
            scope: "https://x/push/onesignal/",
            unregister,
          },
          {
            active: { scriptURL: "https://x/service-worker.js", state: "activated" },
            scope: "https://x/",
            unregister,
          },
        ],
      },
    });

    const list = await listServiceWorkerRegistrationsForDiagnostics();
    expect(list).toHaveLength(2);
    expect(list[0].onesignalRootCanonical).toBe(true);
    expect(list[1].workboxOrPwa).toBe(true);
    expect(unregister).not.toHaveBeenCalled();
  });

  it("módulo de transição não exporta unregister automático", () => {
    // eslint-disable-next-line global-require
    const mod = require("../oneSignalWorkerTransition");
    expect(mod.unregisterLegacyOneSignalRootWorkers).toBeUndefined();
  });
});
