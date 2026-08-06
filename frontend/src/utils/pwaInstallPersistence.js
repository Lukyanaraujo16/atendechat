/**
 * Persistência local da experiência de instalação PWA.
 * Sem tokens ou dados sensíveis — apenas timestamps e flags por utilizador/plataforma.
 */

export const PWA_INSTALL_STORAGE_VERSION = "v1";
export const PWA_INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const PWA_INSTALL_PROMPT_DELAY_MS = 8000;

function safeStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function buildPwaInstallStorageKey(kind, platform, userId) {
  const uid = userId != null && String(userId).trim() !== "" ? String(userId) : "anon";
  const plat = platform || "unknown";
  return `pwaInstall:${PWA_INSTALL_STORAGE_VERSION}:${plat}:${kind}:${uid}`;
}

export function resolveInstallPersistencePlatform(platform) {
  if (platform === "android") return "android";
  if (platform === "iphone" || platform === "ipad") return "ios";
  return "other";
}

export function readDismissedAt(platform, userId, storage = safeStorage()) {
  if (!storage) return null;
  try {
    const key = buildPwaInstallStorageKey(
      "dismissedAt",
      resolveInstallPersistencePlatform(platform),
      userId
    );
    const raw = storage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeDismissedAt(
  platform,
  userId,
  at = Date.now(),
  storage = safeStorage()
) {
  if (!storage) return;
  try {
    const key = buildPwaInstallStorageKey(
      "dismissedAt",
      resolveInstallPersistencePlatform(platform),
      userId
    );
    storage.setItem(key, String(at));
  } catch {
    /* ignore */
  }
}

export function clearDismissedAt(platform, userId, storage = safeStorage()) {
  if (!storage) return;
  try {
    const key = buildPwaInstallStorageKey(
      "dismissedAt",
      resolveInstallPersistencePlatform(platform),
      userId
    );
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readInstalledFlag(userId, storage = safeStorage()) {
  if (!storage) return false;
  try {
    const key = buildPwaInstallStorageKey("installed", "any", userId);
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeInstalledFlag(userId, storage = safeStorage()) {
  if (!storage) return;
  try {
    const key = buildPwaInstallStorageKey("installed", "any", userId);
    storage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function isWithinSnoozePeriod(
  platform,
  userId,
  now = Date.now(),
  snoozeMs = PWA_INSTALL_SNOOZE_MS,
  storage = safeStorage()
) {
  const dismissedAt = readDismissedAt(platform, userId, storage);
  if (dismissedAt == null) return false;
  return now - dismissedAt < snoozeMs;
}

/**
 * Limpa estado transitório (dismiss) ao trocar de utilizador.
 * Não apaga a flag installed do utilizador anterior (isolada por id).
 */
export function clearTransientPwaInstallStateForUser(userId, storage = safeStorage()) {
  if (!storage || userId == null) return;
  ["android", "ios", "other"].forEach((plat) => {
    clearDismissedAt(plat, userId, storage);
  });
}

export function shouldOfferInstallExperience({
  isAuth,
  isStandalone,
  isDesktop,
  platform,
  userId,
  installedFlag,
  now = Date.now(),
  storage = safeStorage(),
} = {}) {
  if (!isAuth) return false;
  if (isStandalone) return false;
  if (isDesktop) return false;
  if (platform !== "android" && platform !== "iphone" && platform !== "ipad") {
    return false;
  }
  if (installedFlag || readInstalledFlag(userId, storage)) return false;
  if (isWithinSnoozePeriod(platform, userId, now, PWA_INSTALL_SNOOZE_MS, storage)) {
    return false;
  }
  return true;
}
