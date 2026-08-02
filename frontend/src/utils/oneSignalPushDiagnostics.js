/**
 * Diagnóstico somente-leitura do fluxo OneSignal Web Push (Fase 2.13D).
 * Sem efeitos colaterais: sem optIn/optOut/unregister/subscribe nativo.
 * Nunca expõe token completo, Subscription ID completo, JWT ou REST API Key.
 */

import {
  detectBrowserLabel,
  maskSubscriptionId,
} from "./oneSignalServiceWorkerPaths";
import { listServiceWorkerRegistrationsForDiagnostics } from "./oneSignalWorkerTransition";
import { readNativePermission } from "./oneSignalPushDomain";

export const PUSH_DIAG_TIMELINE_LIMIT = 50;

/** Flag localStorage opcional para suporte em produção (valor "1"). */
export const ONESIGNAL_DIAG_FLAG_KEY = "atendechat_onesignal_diag";

let timeline = [];
let lifecycleStage = "idle";
let lastSubscriptionChange = null;
let lastPushError = null;
let lastWaitMeta = null;

export function sanitizeDiagnosticError(err) {
  if (err == null) return null;
  try {
    const message = String(err?.message || err || "unknown")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
      .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]*/g, "[jwt]")
      .slice(0, 180);
    return { message, name: err?.name ? String(err.name).slice(0, 80) : undefined };
  } catch {
    return { message: "sanitize_failed" };
  }
}

export function maskEndpoint(endpoint) {
  if (endpoint == null || endpoint === "") {
    return { hasEndpoint: false, endpointHost: null, endpointMasked: null };
  }
  try {
    const u = new URL(String(endpoint));
    const path = u.pathname || "";
    const tail = path.length > 8 ? path.slice(-6) : path;
    return {
      hasEndpoint: true,
      endpointHost: u.host || null,
      endpointMasked: `${u.protocol}//${u.host}/…${tail}`,
    };
  } catch {
    const s = String(endpoint);
    return {
      hasEndpoint: true,
      endpointHost: null,
      endpointMasked: s.length > 12 ? `${s.slice(0, 8)}…` : "…",
    };
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} [detail]
 */
export function recordPushDiagnosticEvent(name, detail = {}) {
  try {
    const ua =
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "";
    const safe = { ...detail };
    delete safe.token;
    delete safe.subscriptionId;
    delete safe.endpoint;
    delete safe.restApiKey;
    delete safe.jwt;
    delete safe.password;
    if (safe.error != null) {
      safe.error = sanitizeDiagnosticError(safe.error);
    }
    if (safe.message != null) {
      safe.message = String(safe.message).slice(0, 180);
    }
    const entry = {
      name: String(name || "unknown"),
      timestamp: new Date().toISOString(),
      browser: detectBrowserLabel(ua),
      ...safe,
    };
    timeline.push(entry);
    if (timeline.length > PUSH_DIAG_TIMELINE_LIMIT) {
      timeline = timeline.slice(-PUSH_DIAG_TIMELINE_LIMIT);
    }
    if (
      name === "error" ||
      name === "timeout" ||
      String(name).endsWith("_failed") ||
      String(name).endsWith("_timeout")
    ) {
      lastPushError = {
        stage: name,
        timestamp: entry.timestamp,
        error: safe.error || (safe.message ? { message: safe.message } : null),
      };
    }
    if (name === "subscription_change_received") {
      lastSubscriptionChange = {
        timestamp: entry.timestamp,
        optedIn: Boolean(safe.optedIn),
        hasId: Boolean(safe.hasId),
        hasToken: Boolean(safe.hasToken),
      };
    }
  } catch {
    /* never throw from diagnostics */
  }
}

export function setPushLifecycleStage(stage) {
  lifecycleStage = stage != null ? String(stage) : "idle";
}

export function getPushLifecycleStage() {
  return lifecycleStage;
}

export function getPushDiagnosticTimeline() {
  return timeline.map((e) => ({ ...e }));
}

export function setLastWaitMeta(meta) {
  lastWaitMeta = meta ? { ...meta } : null;
}

export function getLastWaitMeta() {
  return lastWaitMeta ? { ...lastWaitMeta } : null;
}

export function __resetPushDiagnosticsForTests() {
  timeline = [];
  lifecycleStage = "idle";
  lastSubscriptionChange = null;
  lastPushError = null;
  lastWaitMeta = null;
}

/**
 * Super Admin em supportMode, development, ou flag local explícita.
 */
export function canExposeOneSignalDiagnostics(user, { forceFlag } = {}) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  if (forceFlag === true) {
    return true;
  }
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(ONESIGNAL_DIAG_FLAG_KEY) === "1"
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return Boolean(user?.super === true && user?.supportMode === true);
}

/**
 * Classifica valor de id/token sem await (detecta thenables).
 */
export function classifySubscriptionField(value) {
  if (value === undefined) return { kind: "undefined", present: false };
  if (value === null) return { kind: "null", present: false };
  if (typeof value === "string" && value.trim() === "") {
    return { kind: "empty_string", present: false };
  }
  if (value != null && typeof value.then === "function") {
    return { kind: "thenable", present: false };
  }
  if (typeof value === "string") {
    return { kind: "string", present: true, length: value.length };
  }
  return { kind: typeof value, present: Boolean(value) };
}

/**
 * Lê PushManager.getSubscription() só em modo leitura (sem subscribe).
 */
export async function collectNativePushManagerForRegistration(reg) {
  const base = {
    hasNativePushSubscription: false,
    endpointHost: null,
    endpointMasked: null,
    expirationTime: null,
    pushManagerAvailable: false,
  };
  try {
    const pm = reg?.pushManager;
    if (!pm || typeof pm.getSubscription !== "function") {
      return base;
    }
    base.pushManagerAvailable = true;
    const sub = await pm.getSubscription();
    if (!sub) {
      return base;
    }
    const masked = maskEndpoint(sub.endpoint);
    return {
      hasNativePushSubscription: true,
      endpointHost: masked.endpointHost,
      endpointMasked: masked.endpointMasked,
      expirationTime: sub.expirationTime != null ? sub.expirationTime : null,
      pushManagerAvailable: true,
    };
  } catch (e) {
    return {
      ...base,
      readError: sanitizeDiagnosticError(e)?.message || "pushManager_read_failed",
    };
  }
}

export async function enrichWorkersWithPushManager(workers = [], registrations = []) {
  const byScript = new Map();
  (registrations || []).forEach((reg) => {
    const scriptURL =
      reg.active?.scriptURL ||
      reg.waiting?.scriptURL ||
      reg.installing?.scriptURL ||
      "";
    if (scriptURL) byScript.set(String(scriptURL), reg);
  });

  const out = [];
  for (const w of workers) {
    const reg = byScript.get(w.scriptURL);
    let native = {
      hasNativePushSubscription: false,
      endpointHost: null,
      endpointMasked: null,
      expirationTime: null,
      pushManagerAvailable: false,
    };
    if (reg) {
      native = await collectNativePushManagerForRegistration(reg);
    }
    out.push({
      scriptURL: w.scriptURL,
      scope: w.scope,
      state: w.state,
      active: Boolean(w.active),
      waiting: Boolean(w.waiting),
      installing: Boolean(w.installing),
      onesignalRootCanonical: Boolean(w.onesignalRootCanonical),
      onesignalDeprecatedSubdir: Boolean(w.onesignalDeprecatedSubdir),
      workboxOrPwa: Boolean(w.workboxOrPwa),
      ...native,
    });
  }
  return out;
}

/**
 * Monta o objeto de diagnóstico sanitizado.
 * @param {object} ctx
 */
export async function buildOneSignalPushDiagnostics(ctx = {}) {
  const {
    status = {},
    oneSignalApi = null,
    sdkLoaded = false,
    initialized = false,
    externalIdExpected = null,
    subscriptionWaitMs = null,
    permissionWaitMs = null,
  } = ctx;

  const ua =
    typeof navigator !== "undefined" && navigator.userAgent
      ? navigator.userAgent
      : "";
  const platform =
    typeof navigator !== "undefined" ? String(navigator.platform || "") : "";

  let oneSignalPermission = null;
  try {
    if (oneSignalApi?.Notifications?.permissionNative != null) {
      oneSignalPermission = oneSignalApi.Notifications.permissionNative;
    } else if (typeof oneSignalApi?.Notifications?.permission === "boolean") {
      oneSignalPermission = oneSignalApi.Notifications.permission
        ? "granted"
        : "denied_or_default";
    }
  } catch {
    oneSignalPermission = null;
  }

  let onesignalIdPresent = false;
  let idField = { kind: "unavailable", present: false };
  let tokenField = { kind: "unavailable", present: false };
  try {
    const sub = oneSignalApi?.User?.PushSubscription;
    if (sub) {
      idField = classifySubscriptionField(sub.id);
      tokenField = classifySubscriptionField(sub.token);
      onesignalIdPresent = idField.present;
    }
  } catch {
    /* ignore */
  }

  let serviceWorkerReady = false;
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.ready) {
      await Promise.race([
        navigator.serviceWorker.ready.then(() => {
          serviceWorkerReady = true;
        }),
        new Promise((r) => setTimeout(r, 500)),
      ]);
    }
  } catch {
    serviceWorkerReady = false;
  }

  let rawRegs = [];
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
      rawRegs = await navigator.serviceWorker.getRegistrations();
    }
  } catch {
    rawRegs = [];
  }

  const workersBase = await listServiceWorkerRegistrationsForDiagnostics();
  const workers = await enrichWorkersWithPushManager(workersBase, rawRegs);

  const tokenLength =
    status.token != null && String(status.token).length > 0
      ? String(status.token).length
      : tokenField.present && tokenField.length
        ? tokenField.length
        : 0;

  return {
    timestamp: new Date().toISOString(),
    browser: detectBrowserLabel(ua),
    userAgent: ua ? String(ua).slice(0, 240) : "",
    platform,
    notificationPermission: readNativePermission(),
    oneSignalPermission,
    sdkLoaded: Boolean(sdkLoaded),
    initialized: Boolean(initialized),
    optedIn: Boolean(status.optedIn),
    hasSubscriptionId: Boolean(status.subscriptionId),
    maskedSubscriptionId: maskSubscriptionId(status.subscriptionId),
    hasToken: Boolean(status.token) || Boolean(tokenField.present),
    tokenLength,
    subscriptionIdFieldKind: idField.kind,
    tokenFieldKind: tokenField.kind,
    oneSignalIdPresent: onesignalIdPresent,
    externalIdExpected:
      externalIdExpected != null ? String(externalIdExpected) : null,
    externalIdApplied:
      status.externalUserId != null ? String(status.externalUserId) : null,
    serviceWorkerReady,
    workers,
    lastSubscriptionChange,
    lastPushError,
    lifecycleStage,
    timeline: getPushDiagnosticTimeline(),
    waitMeta: getLastWaitMeta(),
    timeouts: {
      subscriptionWaitMs,
      permissionWaitMs,
    },
    domainState: status.domainState || null,
    errorCode: status.errorCode || null,
    note:
      "Somente leitura. Chrome e Firefox geram Subscription IDs distintos com o mesmo external ID.",
  };
}
