/**
 * Detecção de versão de build (version.json) — sem dados sensíveis.
 */

export const APP_VERSION_STORAGE_KEY = "shc_app_build_version";
export const APP_VERSION_RELOAD_GUARD_KEY = "shc_app_version_reload_guard";
export const APP_VERSION_CHANNEL = "streamhub-chat-app-version";
export const DEFAULT_VERSION_POLL_MS = 90_000;

export function buildVersionUrl(cacheBust = true) {
  const base = `${process.env.PUBLIC_URL || ""}/version.json`.replace(
    /\/{2,}/g,
    "/"
  );
  if (!cacheBust) return base.startsWith("/") ? base : `/${base}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base.startsWith("/") ? base : `/${base}`}${sep}t=${Date.now()}`;
}

export function parseVersionPayload(data) {
  if (!data || typeof data !== "object") return null;
  const version = String(data.version || "").trim();
  if (!version) return null;
  return {
    version,
    builtAt: data.builtAt ? String(data.builtAt) : null,
  };
}

export async function fetchRemoteAppVersion(fetchImpl = fetch) {
  const url = buildVersionUrl(true);
  const res = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (!res.ok) {
    const err = new Error(`version_http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  const contentType = String(res.headers.get("content-type") || "");
  // SPA fallback devolve HTML — tratar como ausência de version.json
  if (contentType.includes("text/html")) {
    const err = new Error("version_not_json");
    err.status = 404;
    throw err;
  }
  const json = await res.json();
  const parsed = parseVersionPayload(json);
  if (!parsed) {
    const err = new Error("version_invalid");
    err.status = 422;
    throw err;
  }
  return parsed;
}

export function readStoredAppVersion(storage = window.localStorage) {
  try {
    return String(storage.getItem(APP_VERSION_STORAGE_KEY) || "").trim() || null;
  } catch {
    return null;
  }
}

export function readRunningBuildVersion(doc = document) {
  try {
    const meta = doc.querySelector?.('meta[name="shc-build-version"]');
    const fromMeta = meta?.getAttribute?.("content");
    if (fromMeta && String(fromMeta).trim()) {
      return String(fromMeta).trim();
    }
  } catch {
    // ignore
  }
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_BUILD_ID
  ) {
    return String(process.env.REACT_APP_BUILD_ID).trim() || null;
  }
  return null;
}

export function resolveLocalAppVersion(doc = document, storage = window.localStorage) {
  return readRunningBuildVersion(doc) || readStoredAppVersion(storage);
}

export function writeStoredAppVersion(version, storage = window.localStorage) {
  try {
    storage.setItem(APP_VERSION_STORAGE_KEY, String(version));
  } catch {
    // ignore quota / private mode
  }
}

export function hasUpdate(localVersion, remoteVersion) {
  if (!localVersion || !remoteVersion) return false;
  return String(localVersion) !== String(remoteVersion);
}

export function shouldBlockReloadLoop(remoteVersion, session = window.sessionStorage) {
  try {
    const key = `${APP_VERSION_RELOAD_GUARD_KEY}:${remoteVersion}`;
    const hits = Number(session.getItem(key) || "0");
    return hits >= 2;
  } catch {
    return false;
  }
}

export function markReloadAttempt(remoteVersion, session = window.sessionStorage) {
  try {
    const key = `${APP_VERSION_RELOAD_GUARD_KEY}:${remoteVersion}`;
    const hits = Number(session.getItem(key) || "0") + 1;
    session.setItem(key, String(hits));
    return hits;
  } catch {
    return 1;
  }
}

export function clearReloadGuard(session = window.sessionStorage) {
  try {
    const keys = [];
    for (let i = 0; i < session.length; i += 1) {
      const k = session.key(i);
      if (k && k.startsWith(`${APP_VERSION_RELOAD_GUARD_KEY}:`)) keys.push(k);
    }
    keys.forEach((k) => session.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Heurística leve: foco em campo editável sugere trabalho não salvo.
 * Não cobre todos os formulários — apenas evita reload automático agressivo.
 */
export function isLikelyUnsavedWork(doc = document) {
  try {
    const el = doc.activeElement;
    if (!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = String(el.getAttribute("type") || "text").toLowerCase();
      return !["button", "submit", "checkbox", "radio", "file", "hidden"].includes(
        type
      );
    }
    if (el.isContentEditable) return true;
    return Boolean(el.closest && el.closest("[data-unsaved-work='true']"));
  } catch {
    return false;
  }
}

export function isChunkLoadError(error) {
  if (!error) return false;
  const name = String(error.name || "");
  const message = String(error.message || error || "");
  if (name === "ChunkLoadError") return true;
  return /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    message
  );
}
