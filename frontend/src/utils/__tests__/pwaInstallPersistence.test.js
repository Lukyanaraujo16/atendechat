import {
  buildPwaInstallStorageKey,
  clearDismissedAt,
  isWithinSnoozePeriod,
  PWA_INSTALL_SNOOZE_MS,
  readDismissedAt,
  readInstalledFlag,
  shouldOfferInstallExperience,
  writeDismissedAt,
  writeInstalledFlag,
} from "../pwaInstallPersistence";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe("pwaInstallPersistence", () => {
  it("cria chaves versionadas por plataforma e utilizador", () => {
    expect(buildPwaInstallStorageKey("dismissedAt", "android", 42)).toBe(
      "pwaInstall:v1:android:dismissedAt:42"
    );
    expect(buildPwaInstallStorageKey("dismissedAt", "ios", 7)).toBe(
      "pwaInstall:v1:ios:dismissedAt:7"
    );
  });

  it("adia por 7 dias após Agora não", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    writeDismissedAt("android", 1, now, storage);
    expect(readDismissedAt("android", 1, storage)).toBe(now);
    expect(isWithinSnoozePeriod("android", 1, now + 1000, PWA_INSTALL_SNOOZE_MS, storage)).toBe(
      true
    );
    expect(
      isWithinSnoozePeriod(
        "android",
        1,
        now + PWA_INSTALL_SNOOZE_MS + 1,
        PWA_INSTALL_SNOOZE_MS,
        storage
      )
    ).toBe(false);
  });

  it("reapresenta após expiração do snooze", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    writeDismissedAt("iphone", 9, now - PWA_INSTALL_SNOOZE_MS - 10, storage);
    expect(
      shouldOfferInstallExperience({
        isAuth: true,
        isStandalone: false,
        isDesktop: false,
        platform: "iphone",
        userId: 9,
        installedFlag: false,
        now,
        storage,
      })
    ).toBe(true);
  });

  it("não oferece em standalone, desktop ou sem auth", () => {
    const storage = memoryStorage();
    expect(
      shouldOfferInstallExperience({
        isAuth: true,
        isStandalone: true,
        isDesktop: false,
        platform: "android",
        userId: 1,
        storage,
      })
    ).toBe(false);
    expect(
      shouldOfferInstallExperience({
        isAuth: true,
        isStandalone: false,
        isDesktop: true,
        platform: "desktop",
        userId: 1,
        storage,
      })
    ).toBe(false);
    expect(
      shouldOfferInstallExperience({
        isAuth: false,
        isStandalone: false,
        isDesktop: false,
        platform: "android",
        userId: 1,
        storage,
      })
    ).toBe(false);
  });

  it("instalação confirmada impede novas exibições", () => {
    const storage = memoryStorage();
    writeInstalledFlag(3, storage);
    expect(readInstalledFlag(3, storage)).toBe(true);
    expect(
      shouldOfferInstallExperience({
        isAuth: true,
        isStandalone: false,
        isDesktop: false,
        platform: "android",
        userId: 3,
        storage,
      })
    ).toBe(false);
  });

  it("isola dismiss por utilizador (troca de conta)", () => {
    const storage = memoryStorage();
    const now = Date.now();
    writeDismissedAt("android", 1, now, storage);
    expect(isWithinSnoozePeriod("android", 1, now + 1000, undefined, storage)).toBe(true);
    expect(isWithinSnoozePeriod("android", 2, now + 1000, undefined, storage)).toBe(false);
    clearDismissedAt("android", 1, storage);
    expect(readDismissedAt("android", 1, storage)).toBeNull();
  });
});
