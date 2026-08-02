/**
 * Estabilidade da Push Subscription OneSignal (Fase 2.13F).
 * Somente leitura — sem manipular device type, token ou API interna.
 *
 * Objetivo: não chamar OneSignal.login enquanto o snapshot Firefox ainda oscila
 * (token/chaves/enabled), o que pode produzir lotes inconsistentes e
 * HTTP 400 "Invalid `token` format for device type iOS".
 */

import {
  detectBrowserLabel,
  isCanonicalOneSignalRootWorkerScript,
  isWorkboxOrPwaServiceWorkerScript,
  maskSubscriptionId,
} from "./oneSignalServiceWorkerPaths";
import { recordPushDiagnosticEvent } from "./oneSignalPushDiagnostics";
import { isEffectivelySubscribed } from "./oneSignalPushDomain";

export const STABILITY_POLL_MS_DEFAULT = 750;
export const STABILITY_REQUIRED_MATCHES_DEFAULT = 3;
export const STABILITY_MIN_WINDOW_MS_DEFAULT = 2500;
export const STABILITY_TIMEOUT_MS_DEFAULT = 25000;

let stabilityPollMs = STABILITY_POLL_MS_DEFAULT;
let stabilityRequiredMatches = STABILITY_REQUIRED_MATCHES_DEFAULT;
let stabilityMinWindowMs = STABILITY_MIN_WINDOW_MS_DEFAULT;
let stabilityTimeoutMs = STABILITY_TIMEOUT_MS_DEFAULT;

/** Contagem sanitizada de mudanças observadas (diagnóstico). */
let snapshotChangesCount = 0;
let lastStableSnapshot = null;
let lastStabilityMeta = null;
let sdkVersionReported = null;

export function __setStabilityTimingForTests({
  pollMs,
  requiredMatches,
  minWindowMs,
  timeoutMs,
} = {}) {
  if (pollMs != null) stabilityPollMs = pollMs;
  if (requiredMatches != null) stabilityRequiredMatches = requiredMatches;
  if (minWindowMs != null) stabilityMinWindowMs = minWindowMs;
  if (timeoutMs != null) stabilityTimeoutMs = timeoutMs;
}

export function __resetStabilityStateForTests() {
  snapshotChangesCount = 0;
  lastStableSnapshot = null;
  lastStabilityMeta = null;
  stabilityPollMs = STABILITY_POLL_MS_DEFAULT;
  stabilityRequiredMatches = STABILITY_REQUIRED_MATCHES_DEFAULT;
  stabilityMinWindowMs = STABILITY_MIN_WINDOW_MS_DEFAULT;
  stabilityTimeoutMs = STABILITY_TIMEOUT_MS_DEFAULT;
}

export function getSnapshotChangesCount() {
  return snapshotChangesCount;
}

export function getLastStabilityMeta() {
  return lastStabilityMeta ? { ...lastStabilityMeta } : null;
}

export function getReportedSdkVersion() {
  return sdkVersionReported;
}

export function setReportedSdkVersion(version) {
  if (version != null && String(version).trim() !== "") {
    sdkVersionReported = String(version).trim();
  }
}

/**
 * Hash curto (não criptográfico) para comparação — nunca logar valor completo.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function hashSensitiveValue(value) {
  if (value == null || value === "") return null;
  const s = String(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${hex}:${s.length}`;
}

function bufferToBase64Url(buf) {
  if (!buf) return null;
  try {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf);
    let bin = "";
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    if (typeof btoa === "function") {
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return hashSensitiveValue(bin);
  } catch {
    return null;
  }
}

/**
 * Assinatura estável do snapshot (campos sanitizados).
 */
export function subscriptionSnapshotSignature(snap) {
  if (!snap) return "";
  return [
    snap.optedIn ? "1" : "0",
    snap.enabled == null ? "" : snap.enabled ? "1" : "0",
    snap.notificationTypes == null ? "" : String(snap.notificationTypes),
    snap.maskedSubscriptionId || "",
    snap.tokenHash || "",
    snap.endpointHost || "",
    snap.endpointHash || "",
    snap.webAuthHash || "",
    snap.webP256Hash || "",
    snap.onesignalWorkerState || "",
  ].join("|");
}

/**
 * Lê PushManager nativo (somente getSubscription) — sem subscribe().
 */
export async function readNativePushFields(reg) {
  const out = {
    endpointHost: null,
    endpointHash: null,
    webAuthHash: null,
    webP256Hash: null,
    hasNativePushSubscription: false,
  };
  try {
    const pm = reg?.pushManager;
    if (!pm || typeof pm.getSubscription !== "function") {
      return out;
    }
    const sub = await pm.getSubscription();
    if (!sub) return out;
    out.hasNativePushSubscription = true;
    if (sub.endpoint) {
      try {
        const u = new URL(String(sub.endpoint));
        out.endpointHost = u.host || null;
      } catch {
        out.endpointHost = null;
      }
      out.endpointHash = hashSensitiveValue(sub.endpoint);
    }
    if (typeof sub.getKey === "function") {
      try {
        const auth = sub.getKey("auth");
        const p256 = sub.getKey("p256dh");
        out.webAuthHash = hashSensitiveValue(bufferToBase64Url(auth));
        out.webP256Hash = hashSensitiveValue(bufferToBase64Url(p256));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export async function inspectOneSignalWorkerGate() {
  const result = {
    serviceWorkerReady: false,
    onesignalWorkerState: "unknown",
    onesignalInstalling: false,
    onesignalWaiting: false,
    onesignalActive: false,
    blocksLogin: false,
    workers: [],
  };
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.getRegistrations) {
    return result;
  }
  try {
    if (navigator.serviceWorker.ready) {
      await Promise.race([
        navigator.serviceWorker.ready.then(() => {
          result.serviceWorkerReady = true;
        }),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs || []) {
      const scriptURL =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      const isOs = isCanonicalOneSignalRootWorkerScript(scriptURL);
      const entry = {
        scriptURL: String(scriptURL),
        scope: String(reg.scope || ""),
        active: Boolean(reg.active),
        waiting: Boolean(reg.waiting),
        installing: Boolean(reg.installing),
        onesignal: isOs,
        workbox: isWorkboxOrPwaServiceWorkerScript(scriptURL),
      };
      result.workers.push(entry);
      if (isOs) {
        result.onesignalInstalling = Boolean(reg.installing);
        result.onesignalWaiting = Boolean(reg.waiting);
        result.onesignalActive = Boolean(reg.active);
        if (reg.installing) result.onesignalWorkerState = "installing";
        else if (reg.waiting) result.onesignalWorkerState = "waiting";
        else if (reg.active) result.onesignalWorkerState = reg.active.state || "activated";
        if (reg.installing || reg.waiting) {
          result.blocksLogin = true;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

/**
 * Snapshot sanitizado da subscription (SDK + PushManager).
 * @param {object|null} api OneSignal API
 * @param {string} source
 */
export async function buildSanitizedSubscriptionSnapshot(api, source = "poll") {
  const sub = api?.User?.PushSubscription;
  let optedIn = false;
  let enabled = null;
  let notificationTypes = null;
  let subscriptionId = null;
  let token = null;
  try {
    optedIn = Boolean(sub?.optedIn);
    if (sub?.optedIn != null) optedIn = Boolean(sub.optedIn);
    if (typeof sub?.optedIn === "boolean") optedIn = sub.optedIn;
    if (sub?.id != null) subscriptionId = String(sub.id);
    if (sub?.token != null) token = String(sub.token);
    if (sub?.enabled != null) enabled = Boolean(sub.enabled);
    if (sub?.notificationTypes != null) {
      notificationTypes = sub.notificationTypes;
    }
  } catch {
    /* ignore */
  }

  const workerGate = await inspectOneSignalWorkerGate();
  let native = {
    endpointHost: null,
    endpointHash: null,
    webAuthHash: null,
    webP256Hash: null,
    hasNativePushSubscription: false,
  };
  const osReg = (workerGate.workers || []).find((w) => w.onesignal);
  if (osReg && typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const match = (regs || []).find((r) => {
        const url =
          r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
        return isCanonicalOneSignalRootWorkerScript(url);
      });
      if (match) {
        native = await readNativePushFields(match);
      }
    } catch {
      /* ignore */
    }
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const snap = {
    timestamp: new Date().toISOString(),
    source: String(source || "poll"),
    browser: detectBrowserLabel(ua),
    sdkVersion: sdkVersionReported,
    optedIn,
    enabled,
    notificationTypes,
    maskedSubscriptionId: maskSubscriptionId(subscriptionId),
    tokenHash: hashSensitiveValue(token),
    tokenLength: token ? token.length : 0,
    endpointHost: native.endpointHost,
    endpointHash: native.endpointHash,
    webAuthHash: native.webAuthHash,
    webP256Hash: native.webP256Hash,
    hasNativePushSubscription: native.hasNativePushSubscription,
    onesignalWorkerState: workerGate.onesignalWorkerState,
    onesignalWaiting: workerGate.onesignalWaiting,
    onesignalInstalling: workerGate.onesignalInstalling,
    blocksLogin: workerGate.blocksLogin,
    effectivelySubscribed: isEffectivelySubscribed({
      optedIn,
      subscriptionId,
      token,
    }),
  };
  snap.signature = subscriptionSnapshotSignature(snap);
  return snap;
}

/**
 * Aguarda snapshot estável antes de login/transfer.
 * change reinicia a contagem; worker installing/waiting bloqueia.
 */
export async function waitForStableSubscriptionSnapshot(api, options = {}) {
  const pollMs = options.pollMs != null ? options.pollMs : stabilityPollMs;
  const requiredMatches =
    options.requiredMatches != null
      ? options.requiredMatches
      : stabilityRequiredMatches;
  const minWindowMs =
    options.minWindowMs != null ? options.minWindowMs : stabilityMinWindowMs;
  const timeoutMs =
    options.timeoutMs != null ? options.timeoutMs : stabilityTimeoutMs;
  const nowFn = options.now || (() => Date.now());
  const sleep =
    options.sleep ||
    ((ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }));

  const startedAt = nowFn();
  let consecutive = 0;
  let lastSig = null;
  let firstMatchAt = null;
  let changeBump = 0;
  let settled = false;
  const sub = api?.User?.PushSubscription;

  const onChange = () => {
    changeBump += 1;
    snapshotChangesCount += 1;
    consecutive = 0;
    lastSig = null;
    firstMatchAt = null;
    recordPushDiagnosticEvent("subscription_change_received", {
      phase: "stability_wait",
      changeBump,
      snapshotChangesCount,
    });
  };

  try {
    if (sub && typeof sub.addEventListener === "function") {
      sub.addEventListener("change", onChange);
    }
  } catch {
    /* ignore */
  }

  recordPushDiagnosticEvent("stability_wait_started", {
    pollMs,
    requiredMatches,
    minWindowMs,
    timeoutMs,
  });

  try {
    while (!settled) {
      const elapsed = nowFn() - startedAt;
      if (elapsed > timeoutMs) {
        const last = await buildSanitizedSubscriptionSnapshot(api, "timeout");
        lastStabilityMeta = {
          ok: false,
          reason: "stability_timeout",
          elapsedMs: elapsed,
          consecutive,
          snapshotChangesCount,
          lastSignature: last.signature,
          blocksLogin: last.blocksLogin,
        };
        recordPushDiagnosticEvent("stability_timeout", {
          elapsedMs: elapsed,
          consecutive,
          snapshotChangesCount,
          blocksLogin: last.blocksLogin,
        });
        const err = new Error("subscription_stability_timeout");
        err.code = "subscription_stability_timeout";
        err.meta = lastStabilityMeta;
        throw err;
      }

      const snap = await buildSanitizedSubscriptionSnapshot(
        api,
        consecutive === 0 ? "stability_first" : "stability_poll"
      );

      if (snap.blocksLogin) {
        consecutive = 0;
        lastSig = null;
        firstMatchAt = null;
        recordPushDiagnosticEvent("stability_blocked_worker", {
          onesignalWorkerState: snap.onesignalWorkerState,
        });
        await sleep(pollMs);
        continue;
      }

      if (!snap.effectivelySubscribed) {
        consecutive = 0;
        lastSig = null;
        firstMatchAt = null;
        await sleep(pollMs);
        continue;
      }

      if (snap.signature === lastSig) {
        consecutive += 1;
      } else {
        if (lastSig != null) {
          snapshotChangesCount += 1;
          recordPushDiagnosticEvent("subscription_snapshot_changed", {
            previousHadToken: Boolean(lastSig.includes("|")),
            snapshotChangesCount,
          });
        }
        lastSig = snap.signature;
        consecutive = 1;
        firstMatchAt = nowFn();
      }

      const windowOk =
        firstMatchAt != null && nowFn() - firstMatchAt >= minWindowMs;
      if (consecutive >= requiredMatches && windowOk) {
        settled = true;
        lastStableSnapshot = snap;
        lastStabilityMeta = {
          ok: true,
          reason: "stable",
          elapsedMs: nowFn() - startedAt,
          consecutive,
          snapshotChangesCount,
          signature: snap.signature,
          maskedSubscriptionId: snap.maskedSubscriptionId,
          endpointHost: snap.endpointHost,
          browser: snap.browser,
          sdkVersion: snap.sdkVersion,
        };
        recordPushDiagnosticEvent("subscription_stable", {
          elapsedMs: lastStabilityMeta.elapsedMs,
          consecutive,
          snapshotChangesCount,
          endpointHost: snap.endpointHost,
          browser: snap.browser,
        });
        return snap;
      }

      await sleep(pollMs);
    }
  } finally {
    try {
      if (sub && typeof sub.removeEventListener === "function") {
        sub.removeEventListener("change", onChange);
      }
    } catch {
      /* ignore */
    }
  }
  return lastStableSnapshot;
}

/**
 * Classifica o erro HTTP 400 de mapeamento iOS vs FirefoxPush.
 */
export function classifyInvalidTokenDeviceTypeError(err) {
  const message = String(err?.message || err || "");
  const title =
    err?.title ||
    err?.errors?.[0]?.title ||
    err?.response?.data?.errors?.[0]?.title ||
    "";
  const combined = `${message} ${title}`;
  const isMatch = /invalid\s*`?token`?\s*format.*device\s*type\s*ios/i.test(
    combined
  ) || /device type iOS/i.test(combined);
  if (!isMatch) {
    return null;
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return {
    code: "onesignal_invalid_token_device_type",
    browser: detectBrowserLabel(ua),
    sdkVersion: sdkVersionReported,
    expectedType: "FirefoxPush",
    messageSanitized: "Invalid token format for device type iOS",
    snapshotChangesCount,
    note:
      "SDK reportou FirefoxPush; servidor rejeitou como iOS — possível lote/subscription instável ou regressão upstream.",
  };
}

export function isAnonymousStabilityProbeAllowed(user) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return Boolean(user?.super === true && user?.supportMode === true);
}
