/**
 * Caminhos e scopes do OneSignal Web Push (Fase 2.13C).
 *
 * Workbox/PWA:  /service-worker.js           → scope /
 * OneSignal:    /OneSignalSDKWorker.js         → scope /push/onesignal/
 * Updater:      /OneSignalSDKUpdaterWorker.js  → scope /push/onesignal/
 *
 * Migração segura (docs OneSignal): alterar somente o scope, manter a URL histórica do worker.
 * Não desregistrar automaticamente o worker OneSignal.
 */

export const ONESIGNAL_SW_FILE = "OneSignalSDKWorker.js";
export const ONESIGNAL_SW_UPDATER_FILE = "OneSignalSDKUpdaterWorker.js";
/** Scope restrito — distinto do Workbox na raiz. */
export const ONESIGNAL_SW_SCOPE_PATH = "/push/onesignal/";

export function publicUrlBase(envPublicUrl = process.env.PUBLIC_URL) {
  return String(envPublicUrl || "").replace(/\/$/, "");
}

/**
 * Monta URL absoluta de asset SW sem barras duplicadas.
 */
export function buildPublicAssetPath(relativePath, envPublicUrl = process.env.PUBLIC_URL) {
  const base = publicUrlBase(envPublicUrl);
  const rel = String(relativePath || "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
  if (!rel) {
    return base ? `${base}/` : "/";
  }
  return base ? `${base}/${rel}` : `/${rel}`;
}

/** URL canónica histórica na raiz. */
export function getOneSignalServiceWorkerPath(envPublicUrl = process.env.PUBLIC_URL) {
  return buildPublicAssetPath(ONESIGNAL_SW_FILE, envPublicUrl);
}

export function getOneSignalServiceWorkerUpdaterPath(envPublicUrl = process.env.PUBLIC_URL) {
  return buildPublicAssetPath(ONESIGNAL_SW_UPDATER_FILE, envPublicUrl);
}

/**
 * Scope isolado (descendente de `/`). Script na raiz pode pedir scope mais restrito.
 * Com PUBLIC_URL=/app → /app/push/onesignal/
 */
export function getOneSignalServiceWorkerScope(envPublicUrl = process.env.PUBLIC_URL) {
  const base = publicUrlBase(envPublicUrl);
  const scopeRel = ONESIGNAL_SW_SCOPE_PATH.replace(/^\//, "");
  if (!base) {
    return ONESIGNAL_SW_SCOPE_PATH;
  }
  return `${base}/${scopeRel}`.replace(/\/{2,}/g, "/");
}

/** Path antigo da 2.13B (subdiretório) — não é canónico. */
export function isDeprecatedSubdirOneSignalWorkerScript(scriptURL) {
  if (!scriptURL) return false;
  try {
    const path = new URL(String(scriptURL), "https://local.invalid").pathname;
    return path.includes("/push/onesignal/OneSignalSDK");
  } catch {
    return false;
  }
}

export function isCanonicalOneSignalRootWorkerScript(scriptURL) {
  if (!scriptURL) return false;
  try {
    const path = new URL(String(scriptURL), "https://local.invalid").pathname;
    if (path.includes("/push/onesignal/")) {
      return false;
    }
    return (
      path === `/${ONESIGNAL_SW_FILE}` ||
      path.endsWith(`/${ONESIGNAL_SW_FILE}`) ||
      path === `/${ONESIGNAL_SW_UPDATER_FILE}` ||
      path.endsWith(`/${ONESIGNAL_SW_UPDATER_FILE}`)
    );
  } catch {
    return false;
  }
}

export function isWorkboxOrPwaServiceWorkerScript(scriptURL) {
  if (!scriptURL) return false;
  try {
    const path = new URL(String(scriptURL), "https://local.invalid").pathname;
    return (
      path.endsWith("/service-worker.js") ||
      path === "/service-worker.js" ||
      path.includes("precache-manifest")
    );
  } catch {
    return false;
  }
}

export function maskSubscriptionId(id) {
  if (id == null || id === "") return null;
  const s = String(id);
  if (s.length <= 10) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export function detectBrowserLabel(userAgent = "") {
  const ua = String(userAgent || "");
  if (/firefox\//i.test(ua) && !/seamonkey/i.test(ua)) return "Firefox";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "Other";
}
