import { openApi } from "./api";
import { registerMinimalPwaServiceWorker } from "../serviceWorkerRegistration";
import {
  PUSH_DOMAIN_STATES,
  derivePushDomainState,
  isEffectivelySubscribed,
  normalizeSubscriptionChangeEvent,
  readNativePermission,
} from "../utils/oneSignalPushDomain";
import {
  detectBrowserLabel,
  getOneSignalServiceWorkerPath,
  getOneSignalServiceWorkerScope,
  getOneSignalServiceWorkerUpdaterPath,
  maskSubscriptionId,
} from "../utils/oneSignalServiceWorkerPaths";
import {
  buildOneSignalPushDiagnostics,
  canExposeOneSignalDiagnostics,
  recordPushDiagnosticEvent,
  setLastWaitMeta,
  setPushLifecycleStage,
  __resetPushDiagnosticsForTests,
} from "../utils/oneSignalPushDiagnostics";

/** Instância do namespace OneSignal após `init` (SDK Web v16 via CDN). */
let oneSignalApi = null;

let initPromise = null;
let oneSignalReady = false;
let sdkLoading = false;
let lastConfig = null;
let statusListenersAttached = false;
let identityUserId = null;
let enableInFlight = null;

let pushStatus = {
  domainState: PUSH_DOMAIN_STATES.NOT_CONFIGURED,
  onesignalEnabled: false,
  onesignalAppId: "",
  pushSupported: true,
  sdkReady: false,
  sdkLoading: false,
  permissionNative: "default",
  optedIn: false,
  subscriptionId: null,
  token: null,
  subscribing: false,
  errorCode: null,
  externalUserId: null,
};

const statusListeners = new Set();

const ONESIGNAL_PAGE_SCRIPT_ID = "onesignal-sdk-page";
const ONESIGNAL_PAGE_SCRIPT_SRC =
  "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

const SUBSCRIPTION_WAIT_MS_DEFAULT = 15000;
const PERMISSION_WAIT_MS_DEFAULT = 120000;
let SUBSCRIPTION_WAIT_MS = SUBSCRIPTION_WAIT_MS_DEFAULT;
let PERMISSION_WAIT_MS = PERMISSION_WAIT_MS_DEFAULT;

function publicUrlBase() {
  return (process.env.PUBLIC_URL || "").replace(/\/$/, "");
}

function logPush(event, detail = {}) {
  try {
    // Observabilidade controlada — sem JWT, REST key ou tokens completos.
    const safe = { ...detail };
    if (safe.token) {
      safe.token = `${String(safe.token).slice(0, 6)}…`;
      safe.hasToken = true;
      delete safe.token;
    }
    if (safe.subscriptionId) {
      safe.maskedSubscriptionId = maskSubscriptionId(safe.subscriptionId);
      safe.hasId = true;
      delete safe.subscriptionId;
    }
    recordPushDiagnosticEvent(event, safe);
    // eslint-disable-next-line no-console
    console.info(`[onesignal-push] ${event}`, safe);
  } catch {
    /* ignore */
  }
}

function notifyStatusListeners() {
  statusListeners.forEach((fn) => {
    try {
      fn({ ...pushStatus });
    } catch {
      /* ignore */
    }
  });
}

function setPushStatus(partial) {
  pushStatus = {
    ...pushStatus,
    ...partial,
  };
  pushStatus.domainState = derivePushDomainState(pushStatus);
  notifyStatusListeners();
  return { ...pushStatus };
}

function readSubscriptionSnapshot(api = oneSignalApi) {
  const sub = api?.User?.PushSubscription;
  return {
    optedIn: Boolean(sub?.optedIn),
    subscriptionId: sub?.id != null ? String(sub.id) : null,
    token: sub?.token != null ? String(sub.token) : null,
  };
}

function refreshFromSdk() {
  const permissionNative = readNativePermission();
  const snap = readSubscriptionSnapshot();
  return setPushStatus({
    sdkReady: oneSignalReady,
    sdkLoading,
    permissionNative,
    optedIn: snap.optedIn,
    subscriptionId: snap.subscriptionId,
    token: snap.token,
    externalUserId: identityUserId,
    errorCode:
      pushStatus.domainState === PUSH_DOMAIN_STATES.SUBSCRIBING
        ? pushStatus.errorCode
        : isEffectivelySubscribed(snap)
          ? null
          : pushStatus.errorCode,
  });
}

export function getOneSignalPushStatus() {
  return { ...pushStatus };
}

export function subscribeOneSignalPushStatus(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  statusListeners.add(listener);
  try {
    listener({ ...pushStatus });
  } catch {
    /* ignore */
  }
  return () => statusListeners.delete(listener);
}

export async function fetchPublicPushConfig() {
  const { data } = await openApi.get("/system-settings/public/push-config");
  return {
    onesignalEnabled: Boolean(data?.onesignalEnabled),
    onesignalAppId: data?.onesignalAppId != null ? String(data.onesignalAppId).trim() : "",
    onesignalEnvironment:
      data?.onesignalEnvironment === "development" ? "development" : "production",
  };
}

function loadOneSignalPageScript() {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("no document"));
  }
  if (document.getElementById(ONESIGNAL_PAGE_SCRIPT_ID)) {
    recordPushDiagnosticEvent("sdk_ready", { alreadyPresent: true });
    return Promise.resolve();
  }
  recordPushDiagnosticEvent("sdk_script_requested");
  setPushLifecycleStage("sdk_script_requested");
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = ONESIGNAL_PAGE_SCRIPT_ID;
    s.src = ONESIGNAL_PAGE_SCRIPT_SRC;
    s.defer = true;
    s.onload = () => {
      recordPushDiagnosticEvent("sdk_ready");
      setPushLifecycleStage("sdk_ready");
      resolve();
    };
    s.onerror = () => {
      logPush("sdk_load_failed");
      setPushLifecycleStage("sdk_load_failed");
      reject(new Error("OneSignal page script failed to load"));
    };
    document.head.appendChild(s);
  });
}

/**
 * @param {Record<string, unknown>} initConfig
 * @returns {Promise<object>}
 */
function runOneSignalDeferredInit(initConfig) {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        recordPushDiagnosticEvent("init_started");
        setPushLifecycleStage("init_started");
        await OneSignal.init(initConfig);
        recordPushDiagnosticEvent("init_completed");
        setPushLifecycleStage("init_completed");
        resolve(OneSignal);
      } catch (e) {
        recordPushDiagnosticEvent("init_failed", { error: e });
        setPushLifecycleStage("init_failed");
        reject(e);
      }
    });
  });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function registerTicketDeepLinkOnNotificationClick(OneSignal) {
  try {
    const Notifications = OneSignal?.Notifications;
    if (!Notifications || typeof Notifications.addEventListener !== "function") {
      return;
    }
    Notifications.addEventListener("click", (event) => {
      try {
        const n = event?.notification;
        const data =
          (typeof n?.additionalData === "function" ? n.additionalData() : n?.additionalData) ||
          n?.data ||
          {};
        const ticketUuid =
          data?.ticketUuid != null && String(data.ticketUuid).trim() !== ""
            ? String(data.ticketUuid).trim()
            : null;
        const ticketId =
          data?.ticketId != null && String(data.ticketId).trim() !== ""
            ? String(data.ticketId).trim()
            : null;
        const pathId = ticketUuid || ticketId;
        if (!pathId || typeof window === "undefined") {
          return;
        }
        const base = publicUrlBase();
        const url = `${base}/tickets/${encodeURIComponent(pathId)}`;
        if (typeof event?.preventDefault === "function") {
          event.preventDefault();
        }
        window.location.assign(url);
      } catch {
        /* noop */
      }
    });
  } catch {
    /* noop */
  }
}

function attachSdkStatusListeners(api) {
  if (statusListenersAttached || !api) return;
  statusListenersAttached = true;

  try {
    const Notifications = api.Notifications;
    if (Notifications && typeof Notifications.addEventListener === "function") {
      Notifications.addEventListener("permissionChange", () => {
        refreshFromSdk();
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const sub = api.User?.PushSubscription;
    if (sub && typeof sub.addEventListener === "function") {
      sub.addEventListener("change", (event) => {
        const normalized = normalizeSubscriptionChangeEvent(event, api);
        recordPushDiagnosticEvent("subscription_change_received", {
          optedIn: normalized.optedIn,
          hasId: Boolean(normalized.subscriptionId),
          hasToken: Boolean(normalized.token),
        });
        setPushStatus({
          permissionNative: readNativePermission(),
          optedIn: normalized.optedIn,
          subscriptionId: normalized.subscriptionId,
          token: normalized.token,
          errorCode: isEffectivelySubscribed(normalized) ? null : pushStatus.errorCode,
        });
      });
    }
  } catch {
    /* ignore */
  }
}

function isPushSupportedBySdk(api) {
  try {
    if (typeof api?.Notifications?.isPushSupported === "function") {
      return Boolean(api.Notifications.isPushSupported());
    }
    if (typeof api?.isPushSupported === "function") {
      return Boolean(api.isPushSupported());
    }
  } catch {
    /* ignore */
  }
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function waitForEffectiveSubscription(api, timeoutMs = SUBSCRIPTION_WAIT_MS) {
  const waitStartedAt = Date.now();
  const immediate = readSubscriptionSnapshot(api);
  recordPushDiagnosticEvent("subscription_state_read", {
    phase: "wait_immediate",
    optedIn: immediate.optedIn,
    hasId: Boolean(immediate.subscriptionId),
    hasToken: Boolean(immediate.token),
  });
  if (isEffectivelySubscribed(immediate)) {
    if (immediate.subscriptionId) {
      recordPushDiagnosticEvent("subscription_id_available", { phase: "immediate" });
    }
    if (immediate.token) {
      recordPushDiagnosticEvent("subscription_token_available", { phase: "immediate" });
    }
    setLastWaitMeta({
      elapsedMs: Date.now() - waitStartedAt,
      timeoutMs,
      resolvedBy: "immediate",
      browser: detectBrowserLabel(
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      ),
    });
    return immediate;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const sub = api?.User?.PushSubscription;
    let changeCount = 0;
    let pollCount = 0;

    const finishOk = (snap, resolvedBy) => {
      if (settled) return;
      settled = true;
      cleanup();
      const elapsedMs = Date.now() - waitStartedAt;
      setLastWaitMeta({
        elapsedMs,
        timeoutMs,
        resolvedBy,
        changeCount,
        pollCount,
        browser: detectBrowserLabel(
          typeof navigator !== "undefined" ? navigator.userAgent : ""
        ),
      });
      if (snap.subscriptionId) {
        recordPushDiagnosticEvent("subscription_id_available", {
          phase: resolvedBy,
          elapsedMs,
        });
      }
      if (snap.token) {
        recordPushDiagnosticEvent("subscription_token_available", {
          phase: resolvedBy,
          elapsedMs,
        });
      }
      recordPushDiagnosticEvent("subscribed_confirmed", {
        resolvedBy,
        elapsedMs,
        optedIn: snap.optedIn,
        hasId: Boolean(snap.subscriptionId),
        hasToken: Boolean(snap.token),
      });
      resolve(snap);
    };
    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      const elapsedMs = Date.now() - waitStartedAt;
      const last = readSubscriptionSnapshot(api);
      setLastWaitMeta({
        elapsedMs,
        timeoutMs,
        resolvedBy: "timeout",
        changeCount,
        pollCount,
        optedIn: last.optedIn,
        hasId: Boolean(last.subscriptionId),
        hasToken: Boolean(last.token),
        browser: detectBrowserLabel(
          typeof navigator !== "undefined" ? navigator.userAgent : ""
        ),
      });
      recordPushDiagnosticEvent("timeout", {
        elapsedMs,
        timeoutMs,
        optedIn: last.optedIn,
        hasId: Boolean(last.subscriptionId),
        hasToken: Boolean(last.token),
        changeCount,
        error: err,
      });
      reject(err);
    };

    const onChange = (event) => {
      changeCount += 1;
      const normalized = normalizeSubscriptionChangeEvent(event, api);
      recordPushDiagnosticEvent("subscription_change_received", {
        phase: "wait",
        changeCount,
        optedIn: normalized.optedIn,
        hasId: Boolean(normalized.subscriptionId),
        hasToken: Boolean(normalized.token),
        elapsedMs: Date.now() - waitStartedAt,
      });
      if (isEffectivelySubscribed(normalized)) {
        finishOk(normalized, "change_event");
        return;
      }
      const snap = readSubscriptionSnapshot(api);
      recordPushDiagnosticEvent("subscription_state_read", {
        phase: "after_change",
        optedIn: snap.optedIn,
        hasId: Boolean(snap.subscriptionId),
        hasToken: Boolean(snap.token),
      });
      if (isEffectivelySubscribed(snap)) {
        finishOk(snap, "change_then_read");
      }
    };

    function cleanup() {
      clearTimeout(timer);
      clearInterval(pollTimer);
      try {
        if (sub && typeof sub.removeEventListener === "function") {
          sub.removeEventListener("change", onChange);
        }
      } catch {
        /* ignore */
      }
    }

    const timer = setTimeout(() => {
      const last = readSubscriptionSnapshot(api);
      if (isEffectivelySubscribed(last)) {
        finishOk(last, "timeout_final_read");
      } else {
        logPush("subscription_missing_after_permission", {
          permission: readNativePermission(),
          optedIn: last.optedIn,
          hasId: Boolean(last.subscriptionId),
          hasToken: Boolean(last.token),
        });
        finishErr(new Error("subscription_missing_after_permission"));
      }
    }, timeoutMs);

    // Polling somente diagnóstico (não altera critério de sucesso nesta fase).
    const pollTimer = setInterval(() => {
      if (settled) return;
      pollCount += 1;
      const snap = readSubscriptionSnapshot(api);
      recordPushDiagnosticEvent("subscription_state_read", {
        phase: "poll",
        pollCount,
        optedIn: snap.optedIn,
        hasId: Boolean(snap.subscriptionId),
        hasToken: Boolean(snap.token),
        elapsedMs: Date.now() - waitStartedAt,
        effectivelySubscribed: isEffectivelySubscribed(snap),
      });
    }, 1000);

    try {
      if (sub && typeof sub.addEventListener === "function") {
        sub.addEventListener("change", onChange);
      }
    } catch {
      /* ignore */
    }

    // Re-check após microtask (SDK pode atualizar sync após optIn).
    Promise.resolve().then(() => {
      const snap = readSubscriptionSnapshot(api);
      recordPushDiagnosticEvent("subscription_state_read", {
        phase: "microtask",
        optedIn: snap.optedIn,
        hasId: Boolean(snap.subscriptionId),
        hasToken: Boolean(snap.token),
      });
      if (isEffectivelySubscribed(snap)) {
        finishOk(snap, "microtask");
      }
    });
  });
}

async function initOneSignalFromConfig(cfg) {
  if (initPromise) {
    return initPromise;
  }
  if (typeof window === "undefined" || !cfg.onesignalAppId) {
    return false;
  }
  sdkLoading = true;
  // Não reutilizar id/token anteriores ao novo init (evita "subscribed" stale).
  setPushStatus({
    onesignalEnabled: Boolean(cfg.onesignalEnabled),
    onesignalAppId: cfg.onesignalAppId,
    sdkLoading: true,
    optedIn: false,
    subscriptionId: null,
    token: null,
    errorCode: null,
  });

  initPromise = (async () => {
    try {
      await loadOneSignalPageScript();
      const serviceWorkerPath = getOneSignalServiceWorkerPath();
      const serviceWorkerUpdaterPath = getOneSignalServiceWorkerUpdaterPath();
      const scope = getOneSignalServiceWorkerScope();
      const api = await runOneSignalDeferredInit({
        appId: cfg.onesignalAppId,
        allowLocalhostAsSecureOrigin: cfg.onesignalEnvironment === "development",
        serviceWorkerPath,
        serviceWorkerUpdaterPath,
        serviceWorkerParam: { scope },
        // Permissão/inscrição só via fluxo explícito (optIn).
        autoRegister: false,
      });
      oneSignalApi = api;
      oneSignalReady = true;
      sdkLoading = false;
      lastConfig = cfg;
      registerTicketDeepLinkOnNotificationClick(api);
      attachSdkStatusListeners(api);
      const supported = isPushSupportedBySdk(api);
      // Relê sempre do SDK após init — nunca confiar em snapshot pré-init.
      const snap = readSubscriptionSnapshot(api);
      setPushStatus({
        onesignalEnabled: true,
        onesignalAppId: cfg.onesignalAppId,
        pushSupported: supported,
        sdkReady: true,
        sdkLoading: false,
        permissionNative: readNativePermission(),
        optedIn: snap.optedIn,
        subscriptionId: snap.subscriptionId,
        token: snap.token,
        errorCode: null,
      });
      logPush("init_ok", {
        serviceWorkerPath,
        scope,
        hasSubscriptionId: Boolean(snap.subscriptionId),
        optedIn: snap.optedIn,
        browser: detectBrowserLabel(
          typeof navigator !== "undefined" ? navigator.userAgent : ""
        ),
      });
      return true;
    } catch (e) {
      logPush("init_failed", { message: e?.message || "unknown" });
      oneSignalApi = null;
      oneSignalReady = false;
      sdkLoading = false;
      initPromise = null;
      setPushStatus({
        sdkReady: false,
        sdkLoading: false,
        optedIn: false,
        subscriptionId: null,
        token: null,
        errorCode: "init_failed",
      });
      return false;
    }
  })();
  return initPromise;
}

/**
 * Arranque: OneSignal (script na raiz, scope /push/onesignal/) e PWA/Workbox (scope /).
 * Não desregistra workers OneSignal automaticamente.
 */
export async function bootstrapPushAndPwaServiceWorker() {
  let onesignalResult = "skipped";
  try {
    const cfg = await fetchPublicPushConfig();
    setPushStatus({
      onesignalEnabled: cfg.onesignalEnabled,
      onesignalAppId: cfg.onesignalAppId,
    });
    if (cfg.onesignalEnabled && cfg.onesignalAppId) {
      const ok = await initOneSignalFromConfig(cfg);
      onesignalResult = ok ? "onesignal" : "onesignal_failed";
    } else {
      setPushStatus({
        onesignalEnabled: false,
        onesignalAppId: "",
        domainState: PUSH_DOMAIN_STATES.NOT_CONFIGURED,
      });
    }
  } catch (e) {
    logPush("sdk_load_failed", { message: e?.message || "config" });
    onesignalResult = "onesignal_failed";
  }
  // PWA/Workbox: scope / — independente do OneSignal com scope descendente.
  registerMinimalPwaServiceWorker();
  return onesignalResult;
}

export function isOneSignalReady() {
  return oneSignalReady;
}

export async function refreshOneSignalPushStatus() {
  try {
    const cfg = lastConfig || (await fetchPublicPushConfig());
    setPushStatus({
      onesignalEnabled: Boolean(cfg.onesignalEnabled),
      onesignalAppId: cfg.onesignalAppId || "",
    });
    if (cfg.onesignalEnabled && cfg.onesignalAppId && !oneSignalReady) {
      await initOneSignalFromConfig(cfg);
    }
  } catch {
    /* ignore */
  }
  return refreshFromSdk();
}

async function applyUserIdentity(user) {
  if (!user?.id || !oneSignalApi) {
    return;
  }
  try {
    recordPushDiagnosticEvent("login_started", {
      externalIdExpected: String(user.id),
    });
    setPushLifecycleStage("login_started");
    await oneSignalApi.login(String(user.id));
    identityUserId = String(user.id);
    recordPushDiagnosticEvent("login_completed", {
      externalIdApplied: identityUserId,
    });
    const companyId = user.companyId ?? localStorage.getItem("companyId") ?? "";
    const queueIds = Array.isArray(user.queues)
      ? user.queues.map((q) => q.id).filter((id) => id != null).join(",")
      : "";
    if (oneSignalApi.User && typeof oneSignalApi.User.addTags === "function") {
      oneSignalApi.User.addTags({
        user_id: String(user.id),
        company_id: String(companyId),
        profile: String(user.profile || ""),
        queue_ids: queueIds || "none",
      });
      recordPushDiagnosticEvent("tags_completed");
    }
    setPushLifecycleStage("tags_completed");
    setPushStatus({ externalUserId: identityUserId });
  } catch (e) {
    logPush("identity_login_failed", { message: e?.message || "unknown" });
    setPushLifecycleStage("login_failed");
    throw e;
  }
}

export async function syncOneSignalUser(user) {
  if (!user?.id) {
    return;
  }
  try {
    const cfg = await fetchPublicPushConfig();
    if (!cfg.onesignalEnabled || !cfg.onesignalAppId) {
      return;
    }
    const ok = await initOneSignalFromConfig(cfg);
    if (!ok || !oneSignalApi) {
      return;
    }
    await applyUserIdentity(user);
    refreshFromSdk();
  } catch {
    /* falha silenciosa no sync automático */
  }
}

export async function oneSignalLogout() {
  if (!oneSignalApi || !oneSignalReady) {
    identityUserId = null;
    setPushStatus({ externalUserId: null });
    return;
  }
  try {
    await oneSignalApi.logout();
  } catch {
    /* noop */
  } finally {
    identityUserId = null;
    setPushStatus({ externalUserId: null });
    refreshFromSdk();
  }
}

/**
 * Pedido explícito: permissão + opt-in + confirmação de subscription (SDK v16).
 * @returns {Promise<{ ok: boolean, domainState: string, errorCode?: string, status: object }>}
 */
export function enableOneSignalPushSubscription({ user } = {}) {
  if (enableInFlight) {
    return enableInFlight;
  }

  enableInFlight = (async () => {
    setPushStatus({
      subscribing: true,
      errorCode: null,
    });
    logPush("opt_in_started");
    recordPushDiagnosticEvent("optin_started");
    setPushLifecycleStage("optin_started");

    try {
      const cfg = await fetchPublicPushConfig();
      if (!cfg.onesignalEnabled || !cfg.onesignalAppId) {
        const status = setPushStatus({
          onesignalEnabled: false,
          onesignalAppId: "",
          subscribing: false,
          errorCode: "not_configured",
        });
        return { ok: false, domainState: status.domainState, errorCode: "not_configured", status };
      }

      const ok = await initOneSignalFromConfig(cfg);
      if (!ok || !oneSignalApi) {
        const status = setPushStatus({
          subscribing: false,
          errorCode: "init_failed",
        });
        return { ok: false, domainState: status.domainState, errorCode: "init_failed", status };
      }

      if (!isPushSupportedBySdk(oneSignalApi)) {
        const status = setPushStatus({
          pushSupported: false,
          subscribing: false,
          errorCode: "unsupported",
        });
        return { ok: false, domainState: status.domainState, errorCode: "unsupported", status };
      }

      const before = readSubscriptionSnapshot(oneSignalApi);
      if (isEffectivelySubscribed(before)) {
        if (user?.id) {
          try {
            await applyUserIdentity(user);
          } catch {
            /* identidade best-effort se já inscrito */
          }
        }
        logPush("subscription_confirmed", { already: true });
        setPushLifecycleStage("subscribed_confirmed");
        const status = setPushStatus({
          subscribing: false,
          errorCode: null,
          ...before,
          permissionNative: readNativePermission(),
        });
        return { ok: true, domainState: status.domainState, status };
      }

      const permissionBefore = readNativePermission();
      recordPushDiagnosticEvent("permission_before", {
        permission: permissionBefore,
      });
      if (permissionBefore === "denied") {
        logPush("permission_denied");
        const status = setPushStatus({
          permissionNative: "denied",
          subscribing: false,
          errorCode: "permission_denied",
        });
        return { ok: false, domainState: status.domainState, errorCode: "permission_denied", status };
      }

      // v16 + autoRegister:false → optIn solicita permissão (se preciso) e cria a Push Subscription.
      const pushSub = oneSignalApi.User?.PushSubscription;
      if (!pushSub || typeof pushSub.optIn !== "function") {
        const status = setPushStatus({
          subscribing: false,
          errorCode: "opt_in_unavailable",
        });
        return { ok: false, domainState: status.domainState, errorCode: "opt_in_unavailable", status };
      }

      try {
        recordPushDiagnosticEvent("permission_requested");
        await withTimeout(Promise.resolve(pushSub.optIn()), PERMISSION_WAIT_MS, "opt_in_timeout");
        recordPushDiagnosticEvent("optin_resolved");
        setPushLifecycleStage("optin_resolved");
      } catch (e) {
        logPush("opt_in_failed", { message: e?.message || "optIn" });
        recordPushDiagnosticEvent("error", {
          stage: e?.message === "opt_in_timeout" ? "opt_in_timeout" : "opt_in_failed",
          error: e,
        });
        const perm = readNativePermission();
        if (perm === "denied") {
          const status = setPushStatus({
            permissionNative: "denied",
            subscribing: false,
            errorCode: "permission_denied",
          });
          return { ok: false, domainState: status.domainState, errorCode: "permission_denied", status };
        }
        const status = setPushStatus({
          permissionNative: perm,
          subscribing: false,
          errorCode: e?.message === "opt_in_timeout" ? "opt_in_timeout" : "opt_in_failed",
        });
        return {
          ok: false,
          domainState: status.domainState,
          errorCode: status.errorCode,
          status,
        };
      }

      const permAfter = readNativePermission();
      setPushStatus({ permissionNative: permAfter });
      if (permAfter === "denied") {
        logPush("permission_denied");
        const status = setPushStatus({
          subscribing: false,
          errorCode: "permission_denied",
        });
        return { ok: false, domainState: status.domainState, errorCode: "permission_denied", status };
      }
      if (permAfter === "granted") {
        logPush("permission_granted");
        recordPushDiagnosticEvent("permission_granted");
      }

      let confirmed;
      try {
        confirmed = await waitForEffectiveSubscription(oneSignalApi, SUBSCRIPTION_WAIT_MS);
      } catch (e) {
        // Fallback: requestPermission + segundo optIn (alguns browsers liberam token só após grant explícito).
        try {
          if (
            permAfter !== "granted" &&
            oneSignalApi.Notifications &&
            typeof oneSignalApi.Notifications.requestPermission === "function"
          ) {
            recordPushDiagnosticEvent("permission_requested", { phase: "fallback" });
            await withTimeout(
              Promise.resolve(oneSignalApi.Notifications.requestPermission()),
              PERMISSION_WAIT_MS,
              "permission_timeout"
            );
          }
          await withTimeout(Promise.resolve(pushSub.optIn()), PERMISSION_WAIT_MS, "opt_in_timeout");
          recordPushDiagnosticEvent("optin_resolved", { phase: "fallback" });
          confirmed = await waitForEffectiveSubscription(oneSignalApi, SUBSCRIPTION_WAIT_MS);
        } catch (e2) {
          logPush("opt_in_failed", { message: e2?.message || e?.message || "confirm" });
          recordPushDiagnosticEvent("error", {
            stage: "subscription_missing_after_permission",
            error: e2,
          });
          setPushLifecycleStage("subscription_missing_after_permission");
          const status = setPushStatus({
            subscribing: false,
            errorCode: "subscription_missing_after_permission",
            permissionNative: readNativePermission(),
            ...readSubscriptionSnapshot(oneSignalApi),
          });
          return {
            ok: false,
            domainState: status.domainState,
            errorCode: "subscription_missing_after_permission",
            status,
          };
        }
      }

      logPush("subscription_confirmed", {
        hasId: Boolean(confirmed.subscriptionId),
        hasToken: Boolean(confirmed.token),
      });
      setPushLifecycleStage("subscribed_confirmed");

      if (user?.id) {
        try {
          await applyUserIdentity(user);
        } catch {
          /* subscription ok; identidade pode falhar temporariamente */
        }
      }

      const status = setPushStatus({
        subscribing: false,
        errorCode: null,
        permissionNative: readNativePermission(),
        ...confirmed,
      });
      return { ok: true, domainState: status.domainState, status };
    } catch (e) {
      logPush("opt_in_failed", { message: e?.message || "unknown" });
      const status = setPushStatus({
        subscribing: false,
        errorCode: "opt_in_failed",
        permissionNative: readNativePermission(),
      });
      return { ok: false, domainState: status.domainState, errorCode: "opt_in_failed", status };
    } finally {
      enableInFlight = null;
    }
  })();

  return enableInFlight;
}

/**
 * @deprecated Prefer enableOneSignalPushSubscription — requestPermission sozinho
 * não conclui inscrição com autoRegister:false no SDK v16.
 */
export async function requestOneSignalPushPermission() {
  const result = await enableOneSignalPushSubscription();
  return Boolean(result?.ok);
}

/**
 * Diagnóstico técnico (console/suporte) — sem secrets nem tokens completos.
 */
export async function getOneSignalPushDiagnostics() {
  refreshFromSdk();
  return buildOneSignalPushDiagnostics({
    status: getOneSignalPushStatus(),
    oneSignalApi,
    sdkLoaded:
      typeof document !== "undefined" &&
      Boolean(document.getElementById(ONESIGNAL_PAGE_SCRIPT_ID)),
    initialized: oneSignalReady,
    externalIdExpected: identityUserId,
    subscriptionWaitMs: SUBSCRIPTION_WAIT_MS,
    permissionWaitMs: PERMISSION_WAIT_MS,
  });
}

/**
 * Expõe diagnóstico no window em development, Super Admin em supportMode,
 * ou com flag localStorage `atendechat_onesignal_diag=1`.
 */
export function exposeOneSignalPushDiagnosticsGlobal(user) {
  if (typeof window === "undefined") return;
  if (!canExposeOneSignalDiagnostics(user)) {
    try {
      if (window.__atendechatOneSignalDiagnostics) {
        delete window.__atendechatOneSignalDiagnostics;
      }
    } catch {
      /* ignore */
    }
    return;
  }
  window.__atendechatOneSignalDiagnostics = getOneSignalPushDiagnostics;
}

/** Test helpers */
export function __setPushWaitMsForTests(subscriptionMs, permissionMs) {
  SUBSCRIPTION_WAIT_MS =
    subscriptionMs != null ? subscriptionMs : SUBSCRIPTION_WAIT_MS_DEFAULT;
  PERMISSION_WAIT_MS =
    permissionMs != null ? permissionMs : PERMISSION_WAIT_MS_DEFAULT;
}

export function __resetOneSignalServiceForTests() {
  oneSignalApi = null;
  initPromise = null;
  oneSignalReady = false;
  sdkLoading = false;
  lastConfig = null;
  statusListenersAttached = false;
  identityUserId = null;
  enableInFlight = null;
  SUBSCRIPTION_WAIT_MS = SUBSCRIPTION_WAIT_MS_DEFAULT;
  PERMISSION_WAIT_MS = PERMISSION_WAIT_MS_DEFAULT;
  statusListeners.clear();
  __resetPushDiagnosticsForTests();
  pushStatus = {
    domainState: PUSH_DOMAIN_STATES.NOT_CONFIGURED,
    onesignalEnabled: false,
    onesignalAppId: "",
    pushSupported: true,
    sdkReady: false,
    sdkLoading: false,
    permissionNative: "default",
    optedIn: false,
    subscriptionId: null,
    token: null,
    subscribing: false,
    errorCode: null,
    externalUserId: null,
  };
  try {
    const el = document.getElementById(ONESIGNAL_PAGE_SCRIPT_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch {
    /* ignore */
  }
}

export function __setOneSignalApiForTests(api) {
  oneSignalApi = api;
  oneSignalReady = Boolean(api);
}

/** Prepara API mockada sem CDN (testes de opt-in/identidade). */
export function __forceOneSignalReadyForTests(api, cfg = {}) {
  oneSignalApi = api;
  oneSignalReady = Boolean(api);
  sdkLoading = false;
  initPromise = Promise.resolve(true);
  lastConfig = {
    onesignalEnabled: cfg.onesignalEnabled !== false,
    onesignalAppId: cfg.onesignalAppId || "app-id-test",
    onesignalEnvironment: cfg.onesignalEnvironment || "development",
  };
  statusListenersAttached = false;
  if (api) {
    attachSdkStatusListeners(api);
  }
  setPushStatus({
    onesignalEnabled: lastConfig.onesignalEnabled,
    onesignalAppId: lastConfig.onesignalAppId,
    pushSupported: true,
    sdkReady: true,
    sdkLoading: false,
    permissionNative: readNativePermission(),
    ...readSubscriptionSnapshot(api),
    errorCode: null,
    subscribing: false,
  });
}
