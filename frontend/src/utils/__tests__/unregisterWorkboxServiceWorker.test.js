import {
  clearAppOwnedCaches,
  isAppOwnedCacheName,
  unregisterWorkboxServiceWorkers,
} from "../unregisterWorkboxServiceWorker";
import {
  isCanonicalOneSignalRootWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
} from "../oneSignalServiceWorkerPaths";

describe("unregisterWorkboxServiceWorker", () => {
  it("remove apenas SW Workbox/PWA e preserva OneSignal", async () => {
    const unregisterWb = jest.fn(async () => true);
    const unregisterOs = jest.fn(async () => true);
    const unregisterOsUpdater = jest.fn(async () => true);
    const container = {
      getRegistrations: async () => [
        {
          active: { scriptURL: "https://app.example/service-worker.js" },
          unregister: unregisterWb,
        },
        {
          active: { scriptURL: "https://app.example/OneSignalSDKWorker.js" },
          unregister: unregisterOs,
        },
        {
          active: {
            scriptURL: "https://app.example/OneSignalSDKUpdaterWorker.js",
          },
          unregister: unregisterOsUpdater,
        },
      ],
    };
    const result = await unregisterWorkboxServiceWorkers(container);
    expect(unregisterWb).toHaveBeenCalled();
    expect(unregisterOs).not.toHaveBeenCalled();
    expect(unregisterOsUpdater).not.toHaveBeenCalled();
    expect(result.unregistered).toBe(1);
  });

  it("critérios: Workbox vs OneSignal por scriptURL", () => {
    expect(
      isWorkboxOrPwaServiceWorkerScript(
        "https://app.example/service-worker.js"
      )
    ).toBe(true);
    expect(
      isCanonicalOneSignalRootWorkerScript(
        "https://app.example/OneSignalSDKWorker.js"
      )
    ).toBe(true);
    expect(
      isWorkboxOrPwaServiceWorkerScript(
        "https://app.example/OneSignalSDKWorker.js"
      )
    ).toBe(false);
  });

  it("limpa somente caches do app (filtro restrito)", async () => {
    expect(isAppOwnedCacheName("workbox-precache-v2")).toBe(true);
    expect(isAppOwnedCacheName("precache-manifest")).toBe(true);
    expect(isAppOwnedCacheName("other-site-cache")).toBe(false);
    expect(isAppOwnedCacheName("onesignal-sdk-cache")).toBe(false);
    expect(isAppOwnedCacheName("random-runtime-cache")).toBe(false);

    const cacheApi = {
      keys: async () => [
        "workbox-precache-v2",
        "other-site-cache",
        "precache-manifest",
        "onesignal-sdk-cache",
        "random-runtime-cache",
      ],
      delete: jest.fn(async () => true),
    };
    const { deleted } = await clearAppOwnedCaches(cacheApi);
    expect(cacheApi.delete).toHaveBeenCalledWith("workbox-precache-v2");
    expect(cacheApi.delete).toHaveBeenCalledWith("precache-manifest");
    expect(cacheApi.delete).not.toHaveBeenCalledWith("other-site-cache");
    expect(cacheApi.delete).not.toHaveBeenCalledWith("onesignal-sdk-cache");
    expect(cacheApi.delete).not.toHaveBeenCalledWith("random-runtime-cache");
    expect(deleted).toHaveLength(2);
  });
});
