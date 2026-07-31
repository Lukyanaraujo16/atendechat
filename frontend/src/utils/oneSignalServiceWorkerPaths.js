/**
 * Caminhos e scopes do OneSignal Web Push (isolados do Workbox PWA).
 *
 * Workbox/PWA: /service-worker.js → scope /
 * OneSignal:   /push/onesignal/*.js → scope /push/onesignal/
 */

export const ONESIGNAL_SW_DIR = "push/onesignal";
export const ONESIGNAL_SW_FILE = "OneSignalSDKWorker.js";
export const ONESIGNAL_SW_UPDATER_FILE = "OneSignalSDKUpdaterWorker.js";
export const ONESIGNAL_SW_SCOPE_PATH = "/push/onesignal/";

/** Scripts legados na raiz (scope /) — candidatos a unregister seletivo. */
export const LEGACY_ONESIGNAL_ROOT_SW_FILES = [
  "OneSignalSDKWorker.js",
  "OneSignalSDKUpdaterWorker.js",
];

export function publicUrlBase(envPublicUrl = process.env.PUBLIC_URL) {
  return String(envPublicUrl || "").replace(/\/$/, "");
}

/**
 * Monta URL absoluta de asset SW sem barras duplicadas.
 * Ex.: push/onesignal/OneSignalSDKWorker.js → /push/onesignal/OneSignalSDKWorker.js
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

export function getOneSignalServiceWorkerPath(envPublicUrl = process.env.PUBLIC_URL) {
  return buildPublicAssetPath(`${ONESIGNAL_SW_DIR}/${ONESIGNAL_SW_FILE}`, envPublicUrl);
}

export function getOneSignalServiceWorkerUpdaterPath(envPublicUrl = process.env.PUBLIC_URL) {
  return buildPublicAssetPath(
    `${ONESIGNAL_SW_DIR}/${ONESIGNAL_SW_UPDATER_FILE}`,
    envPublicUrl
  );
}

/**
 * Scope deve cobrir o diretório do worker (requisito do browser).
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

export function isLegacyOneSignalRootWorkerScript(scriptURL) {
  if (!scriptURL) return false;
  try {
    const path = new URL(String(scriptURL), "https://local.invalid").pathname;
    // Legado: /OneSignalSDKWorker.js — não o isolado /push/onesignal/...
    if (path.includes(`/${ONESIGNAL_SW_DIR}/`)) {
      return false;
    }
    return LEGACY_ONESIGNAL_ROOT_SW_FILES.some(
      (file) => path === `/${file}` || path.endsWith(`/${file}`)
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
