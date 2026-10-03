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
import { resolveOneSignalNotificationPath } from "../utils/oneSignalNotificationDeepLink";
import {
  assertExternalIdIsNotCompanyId,
  buildOneSignalIdentitySyncKey,
  buildOneSignalIdentityTags,
  isRemoteOneSignalIdentityConfirmed,
  oneSignalTagsSignature,
  resolveOneSignalCompanyIdTag,
  resolveOneSignalExternalId,
} from "../utils/oneSignalIdentity";
import { recoverLegacyOneSignalIdentityBeforeInit } from "../utils/oneSignalLegacyIdentityRecovery";
import {
  buildSanitizedSubscriptionSnapshot,
  classifyInvalidTokenDeviceTypeError,
  getLastStabilityMeta,
  getSnapshotChangesCount,
  isAnonymousStabilityProbeAllowed,
  setReportedSdkVersion,
  waitForStableSubscriptionSnapshot,
  __resetStabilityStateForTests,
  __setStabilityTimingForTests,
} from "../utils/oneSignalSubscriptionStability";

/** Instância do namespace OneSignal após `init` (SDK Web v16 via CDN). */
let oneSignalApi = null;

let initPromise = null;
let oneSignalReady = false;
let sdkLoading = false;
let lastConfig = null;
let statusListenersAttached = false;
let identityUserId = null;
let enableInFlight = null;
/** Single-flight da sincronização login → tags. */
let identitySyncInFlight = null;
let identitySyncInFlightKey = null;
/** Último sync concluído com sucesso (evita PATCH 409 repetidos). */
let lastIdentitySync = null;
/** Contagem de tentativas de identity sync (diagnóstico). */
let identitySyncAttempt = 0;
/** Single-flight da espera de estabilidade. */
let stabilityWaitInFlight = null;
/** Modo diagnóstico: pausar antes do login (Super Admin / dev). */
let deferLoginForProbe = false;
let lastAnonymousProbe = null;

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
/** Associação de identidade — não cria a Push Subscription. */
const LOGIN_WAIT_MS_DEFAULT = 15000;
const PUSH_CONFIG_WAIT_MS = 15000;
const INIT_WAIT_MS = 20000;
let SUBSCRIPTION_WAIT_MS = SUBSCRIPTION_WAIT_MS_DEFAULT;
let PERMISSION_WAIT_MS = PERMISSION_WAIT_MS_DEFAULT;
let LOGIN_WAIT_MS = LOGIN_WAIT_MS_DEFAULT;
let REMOTE_CONFIRM_ATTEMPTS = 3;
let REMOTE_CONFIRM_INTERVAL_MS = 40;

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
        const path = resolveOneSignalNotificationPath(data);
        if (!path || typeof window === "undefined") {
          return;
        }
        const base = publicUrlBase();
        const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
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

function observePollMs() {
  const fromWait = Math.floor(Number(SUBSCRIPTION_WAIT_MS) / 5) || 10;
  return Math.min(250, Math.max(10, fromWait));
}

/**
 * Confirma inscrição efetiva só depois do helper de estabilidade
 * (leituras consecutivas da mesma assinatura). Um único snapshot,
 * permission granted ou optedIn sem id/token não conclui.
 */
async function confirmStableEffectiveSubscription(api, phase) {
  const detected = readSubscriptionSnapshot(api);
  if (!isEffectivelySubscribed(detected)) {
    return null;
  }
  recordPushDiagnosticEvent("subscription_detected_by_poll", {
    phase,
    optedIn: detected.optedIn,
    hasId: Boolean(detected.subscriptionId),
    hasToken: Boolean(detected.token),
  });
  logPush("subscription_detected_by_poll", {
    phase,
    hasId: Boolean(detected.subscriptionId),
    hasToken: Boolean(detected.token),
  });
  const stableSnapshot = await waitForStableSubscriptionSnapshot(api);
  const confirmed = readSubscriptionSnapshot(api);
  if (!isEffectivelySubscribed(confirmed) || !stableSnapshot?.signature) {
    return null;
  }
  recordPushDiagnosticEvent("subscription_stability_confirmed", {
    phase,
    hasId: Boolean(confirmed.subscriptionId),
    hasToken: Boolean(confirmed.token),
  });
  logPush("subscription_stability_confirmed", {
    phase,
    hasId: Boolean(confirmed.subscriptionId),
    hasToken: Boolean(confirmed.token),
  });
  if (confirmed.subscriptionId) {
    recordPushDiagnosticEvent("subscription_id_available", { phase });
  }
  if (confirmed.token) {
    recordPushDiagnosticEvent("subscription_token_available", { phase });
  }
  return { ...confirmed, stableSnapshot };
}

function subscriptionFieldsForStatus(snap) {
  if (!snap) return {};
  return {
    optedIn: Boolean(snap.optedIn),
    subscriptionId: snap.subscriptionId || null,
    token: snap.token || null,
  };
}

function watchPushSubscriptionChange(api) {
  const sub = api?.User?.PushSubscription;
  let changed = false;
  const onChange = () => {
    changed = true;
  };
  try {
    if (sub && typeof sub.addEventListener === "function") {
      sub.addEventListener("change", onChange);
    }
  } catch {
    /* ignore */
  }
  return {
    changed: () => changed,
    stop() {
      try {
        if (sub && typeof sub.removeEventListener === "function") {
          sub.removeEventListener("change", onChange);
        }
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Reutiliza a estabilidade recém-confirmada só se a assinatura sanitizada
 * continua igual. O listener permanece até o login para um `change`
 * posterior invalidar a reutilização.
 */
async function reuseConfirmedStabilityIfUnchanged(api, confirmedStableSnapshot) {
  if (!confirmedStableSnapshot?.signature) return null;
  const watch = watchPushSubscriptionChange(api);
  try {
    const current = await buildSanitizedSubscriptionSnapshot(api, "pre_login_reuse");
    if (
      watch.changed() ||
      current.blocksLogin ||
      !current.effectivelySubscribed ||
      current.signature !== confirmedStableSnapshot.signature
    ) {
      watch.stop();
      return null;
    }
    return { snapshot: current, watch };
  } catch (error) {
    watch.stop();
    throw error;
  }
}

async function waitForEffectiveSubscription(api, timeoutMs = SUBSCRIPTION_WAIT_MS) {
  const waitStartedAt = Date.now();
  const pollMs = observePollMs();
  let pollCount = 0;

  while (Date.now() - waitStartedAt < timeoutMs) {
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
    if (isEffectivelySubscribed(snap)) {
      try {
        const confirmed = await confirmStableEffectiveSubscription(api, "poll_stable");
        if (confirmed) {
          setLastWaitMeta({
            elapsedMs: Date.now() - waitStartedAt,
            timeoutMs,
            resolvedBy: "poll_stable",
            pollCount,
            browser: detectBrowserLabel(
              typeof navigator !== "undefined" ? navigator.userAgent : ""
            ),
          });
          recordPushDiagnosticEvent("subscribed_confirmed", {
            resolvedBy: "poll_stable",
            elapsedMs: Date.now() - waitStartedAt,
            optedIn: confirmed.optedIn,
            hasId: Boolean(confirmed.subscriptionId),
            hasToken: Boolean(confirmed.token),
          });
          return confirmed;
        }
      } catch (err) {
        const last = readSubscriptionSnapshot(api);
        if (!isEffectivelySubscribed(last)) {
          break;
        }
        recordPushDiagnosticEvent("timeout", {
          phase: "stability",
          elapsedMs: Date.now() - waitStartedAt,
          error: err,
        });
      }
    }
    await delayMs(pollMs);
  }

  const last = readSubscriptionSnapshot(api);
  setLastWaitMeta({
    elapsedMs: Date.now() - waitStartedAt,
    timeoutMs,
    resolvedBy: "timeout",
    pollCount,
    optedIn: last.optedIn,
    hasId: Boolean(last.subscriptionId),
    hasToken: Boolean(last.token),
    browser: detectBrowserLabel(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    ),
  });
  logPush("subscription_missing_after_permission", {
    permission: readNativePermission(),
    optedIn: last.optedIn,
    hasId: Boolean(last.subscriptionId),
    hasToken: Boolean(last.token),
  });
  recordPushDiagnosticEvent("timeout", {
    elapsedMs: Date.now() - waitStartedAt,
    timeoutMs,
    optedIn: last.optedIn,
    hasId: Boolean(last.subscriptionId),
    hasToken: Boolean(last.token),
    pollCount,
  });
  throw new Error("subscription_missing_after_permission");
}

/**
 * optIn pode permanecer pendente. Em paralelo, um snapshot estável
 * (optedIn + id/token) conclui sem esperar o timeout de 120s.
 * A Promise do optIn é sempre capturada — rejection tardia não fica solta.
 */
async function settlePushSubscriptionAfterOptIn(api, pushSub) {
  let optInResult = null;
  let settledBySnapshot = false;
  const optInTask = withTimeout(
    Promise.resolve().then(() => pushSub.optIn()),
    PERMISSION_WAIT_MS,
    "opt_in_timeout"
  ).then(
    () => {
      optInResult = { ok: true };
      if (settledBySnapshot) return;
      recordPushDiagnosticEvent("optin_resolved");
      setPushLifecycleStage("optin_resolved");
      logPush("optin_resolved");
    },
    (error) => {
      optInResult = { ok: false, error };
      if (settledBySnapshot) return;
      const stage =
        error?.message === "opt_in_timeout" ? "opt_in_timeout" : "opt_in_failed";
      logPush(stage, { message: error?.message || "optIn" });
      recordPushDiagnosticEvent("error", { stage, error });
    }
  );

  const started = Date.now();
  const pollMs = observePollMs();
  while (!optInResult && Date.now() - started < PERMISSION_WAIT_MS) {
    const snap = readSubscriptionSnapshot(api);
    if (isEffectivelySubscribed(snap)) {
      try {
        const confirmed = await confirmStableEffectiveSubscription(
          api,
          "during_opt_in"
        );
        if (confirmed) {
          settledBySnapshot = true;
          return confirmed;
        }
      } catch (stabilityErr) {
        recordPushDiagnosticEvent("timeout", {
          phase: "stability_during_opt_in",
          error: stabilityErr,
        });
      }
    }
    if (optInResult && !optInResult.ok) {
      break;
    }
    await delayMs(pollMs);
  }

  if (!optInResult) {
    await optInTask;
  }
  if (optInResult && !optInResult.ok) {
    throw optInResult.error || new Error("opt_in_failed");
  }
  return waitForEffectiveSubscription(api, SUBSCRIPTION_WAIT_MS);
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
      try {
        await recoverLegacyOneSignalIdentityBeforeInit({
          appId: cfg.onesignalAppId,
          log: logPush,
        });
      } catch (recoveryError) {
        logPush("legacy_identity_recovery_failed", { reason: "unexpected" });
      }
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
      try {
        const ver =
          api?.VERSION ||
          api?.SdkVersion ||
          api?._VERSION ||
          (typeof window !== "undefined" && window.OneSignal?.VERSION) ||
          null;
        if (ver) setReportedSdkVersion(ver);
        else setReportedSdkVersion("160609"); // CDN v16 atual (page.es6.js?v=160609)
      } catch {
        setReportedSdkVersion("160609");
      }
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
    if (cfg.onesignalEnabled && cfg.onesignalAppId) {
      sdkLoading = true;
      oneSignalReady = false;
      setPushStatus({
        onesignalEnabled: true,
        onesignalAppId: cfg.onesignalAppId,
        sdkLoading: true,
        sdkReady: false,
      });
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
  // Desliga Workbox/PWA (scope /). OneSignal permanece com scope /push/onesignal/.
  registerMinimalPwaServiceWorker();
  return onesignalResult;
}

export function isOneSignalReady() {
  return oneSignalReady;
}

export async function refreshOneSignalPushStatus() {
  try {
    const cfg = lastConfig || (await fetchPublicPushConfig());
    const willInit = Boolean(cfg.onesignalEnabled && cfg.onesignalAppId && !oneSignalReady);
    if (willInit) {
      sdkLoading = true;
      oneSignalReady = false;
    }
    setPushStatus({
      onesignalEnabled: Boolean(cfg.onesignalEnabled),
      onesignalAppId: cfg.onesignalAppId || "",
      ...(willInit ? { sdkLoading: true, sdkReady: false } : {}),
    });
    if (willInit) {
      await initOneSignalFromConfig(cfg);
    }
  } catch {
    /* ignore */
  }
  return refreshFromSdk();
}

async function ensureStableSubscriptionBeforeLogin(api) {
  if (stabilityWaitInFlight) {
    recordPushDiagnosticEvent("identity_sync_deduplicated", {
      reason: "stability_in_flight",
    });
    return stabilityWaitInFlight;
  }
  stabilityWaitInFlight = (async () => {
    try {
      return await waitForStableSubscriptionSnapshot(api);
    } finally {
      stabilityWaitInFlight = null;
    }
  })();
  return stabilityWaitInFlight;
}

function readPublicOneSignalIdentity(api) {
  const user = api && api.User;
  if (!user) return { externalId: null, onesignalId: null };
  return {
    externalId: user.externalId,
    onesignalId: user.onesignalId,
  };
}

async function confirmRemoteOneSignalIdentity(api, expectedExternalId) {
  const attempts = Math.max(1, REMOTE_CONFIRM_ATTEMPTS);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0 && REMOTE_CONFIRM_INTERVAL_MS > 0) {
      await delayMs(REMOTE_CONFIRM_INTERVAL_MS);
    }
    if (
      isRemoteOneSignalIdentityConfirmed(
        readPublicOneSignalIdentity(api),
        expectedExternalId
      )
    ) {
      return true;
    }
  }
  return false;
}

async function applyUserIdentity(user, { skipStabilityWait = false, confirmedStableSnapshot = null } = {}) {
  if (!oneSignalApi) {
    return { ok: false, reason: "sdk_not_ready" };
  }

  const externalId = resolveOneSignalExternalId(user);
  if (!externalId) {
    recordPushDiagnosticEvent("identity_login_failed", {
      reason: "missing_user_id",
    });
    return { ok: false, reason: "missing_user_id" };
  }

  const companyIdTag = resolveOneSignalCompanyIdTag(user);
  const ambiguity = assertExternalIdIsNotCompanyId(externalId, companyIdTag);
  const tags = buildOneSignalIdentityTags(user, externalId);
  const tagsSig = oneSignalTagsSignature(tags);
  const snap = readSubscriptionSnapshot(oneSignalApi);
  const appId = lastConfig?.onesignalAppId || pushStatus.onesignalAppId || "";
  const syncKey = buildOneSignalIdentitySyncKey({
    appId,
    externalId,
    subscriptionId: snap.subscriptionId || "",
  });

  // Dedup: mesma identidade + mesmas tags já aplicadas.
  if (
    lastIdentitySync &&
    lastIdentitySync.key === syncKey &&
    lastIdentitySync.tagsSignature === tagsSig &&
    identityUserId === externalId
  ) {
    recordPushDiagnosticEvent("identity_sync_deduplicated", {
      externalId,
      companyIdTag,
      ambiguous: ambiguity.reason === "external_id_equals_company_id_ambiguous",
    });
    return { ok: true, deduplicated: true, externalId, remoteConfirmed: true };
  }

  // Single-flight: callers concorrentes reutilizam a mesma Promise.
  if (identitySyncInFlight && identitySyncInFlightKey === syncKey) {
    recordPushDiagnosticEvent("identity_sync_deduplicated", {
      externalId,
      reason: "in_flight",
    });
    return identitySyncInFlight;
  }

  identitySyncAttempt += 1;
  const attempt = identitySyncAttempt;
  recordPushDiagnosticEvent("identity_sync_started", {
    externalId,
    companyIdTag,
    attempt,
    ambiguous: ambiguity.reason === "external_id_equals_company_id_ambiguous",
  });
  setPushLifecycleStage("identity_sync_started");

  identitySyncInFlightKey = syncKey;
  identitySyncInFlight = (async () => {
    try {
      // Defesa: External ID nunca deve ser companyId quando user.id é outro valor.
      if (
        companyIdTag &&
        externalId === companyIdTag &&
        user?.id != null &&
        String(user.id) !== companyIdTag
      ) {
        const err = new Error("external_id_would_be_company_id");
        recordPushDiagnosticEvent("identity_login_failed", {
          error: err,
          externalId,
          companyIdTag,
          attempt,
        });
        throw err;
      }

      const pre = readSubscriptionSnapshot(oneSignalApi);
      const needsStability =
        !skipStabilityWait &&
        (isEffectivelySubscribed(pre) || Boolean(pre.token) || Boolean(pre.subscriptionId));

      let stableSnap = null;
      let stabilityWatch = null;
      if (needsStability) {
        setPushLifecycleStage("stability_wait");
        const reused = await reuseConfirmedStabilityIfUnchanged(
          oneSignalApi,
          confirmedStableSnapshot
        );
        if (reused) {
          stableSnap = reused.snapshot;
          stabilityWatch = reused.watch;
          recordPushDiagnosticEvent("subscription_stability_reused", {
            hasId: Boolean(reused.snapshot.maskedSubscriptionId),
            hasToken: Boolean(reused.snapshot.tokenHash),
          });
          logPush("subscription_stability_reused", {
            hasId: Boolean(reused.snapshot.maskedSubscriptionId),
            hasToken: Boolean(reused.snapshot.tokenHash),
          });
        } else {
          if (confirmedStableSnapshot?.signature) {
            recordPushDiagnosticEvent("subscription_stability_revalidation_required", {
              reason: "signature_or_worker_changed",
            });
            logPush("subscription_stability_revalidation_required");
          }
          stableSnap = await ensureStableSubscriptionBeforeLogin(oneSignalApi);
        }
      }

      if (deferLoginForProbe && isAnonymousStabilityProbeAllowed(user)) {
        if (stabilityWatch) stabilityWatch.stop();
        stabilityWatch = null;
        lastAnonymousProbe = {
          at: new Date().toISOString(),
          phase: "before_login",
          stable: Boolean(stableSnap),
          stabilityMeta: getLastStabilityMeta(),
          snapshot: stableSnap
            ? {
                signature: stableSnap.signature,
                optedIn: stableSnap.optedIn,
                maskedSubscriptionId: stableSnap.maskedSubscriptionId,
                endpointHost: stableSnap.endpointHost,
                tokenHash: stableSnap.tokenHash,
                browser: stableSnap.browser,
                sdkVersion: stableSnap.sdkVersion,
              }
            : null,
        };
        recordPushDiagnosticEvent("anonymous_probe_captured", {
          phase: "before_login",
        });
        setPushStatus({ externalUserId: null });
        return {
          ok: true,
          deferredLogin: true,
          externalId,
          attempt,
          probe: lastAnonymousProbe,
        };
      }

      recordPushDiagnosticEvent("identity_login_started", {
        externalId,
        attempt,
        snapshotChangesCount: getSnapshotChangesCount(),
        endpointHost: stableSnap?.endpointHost || null,
      });
      if (stabilityWatch?.changed()) {
        stabilityWatch.stop();
        stabilityWatch = null;
        recordPushDiagnosticEvent("subscription_stability_revalidation_required", {
          reason: "change_before_login",
        });
        logPush("subscription_stability_revalidation_required", {
          reason: "change_before_login",
        });
        stableSnap = await ensureStableSubscriptionBeforeLogin(oneSignalApi);
      }
      if (stabilityWatch) stabilityWatch.stop();
      logPush("identity_login_started", { attempt });
      setPushLifecycleStage("login_started");
      const loginPromise = Promise.resolve().then(() => oneSignalApi.login(externalId));
      const guardedLogin = loginPromise.then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error })
      );
      const loginOutcome = await withTimeout(
        guardedLogin,
        LOGIN_WAIT_MS,
        "identity_login_timeout"
      );
      if (!loginOutcome?.ok) {
        throw loginOutcome.error || new Error("identity_login_failed");
      }
      recordPushDiagnosticEvent("identity_login_promise_resolved", { attempt });
      logPush("identity_login_promise_resolved", { attempt });
      const remoteConfirmed = await confirmRemoteOneSignalIdentity(
        oneSignalApi,
        externalId
      );
      if (remoteConfirmed) {
        identityUserId = externalId;
        recordPushDiagnosticEvent("identity_remote_confirmed", { attempt });
        logPush("identity_remote_confirmed", { attempt });
      } else {
        identityUserId = null;
        recordPushDiagnosticEvent("identity_remote_pending", { attempt });
        logPush("identity_remote_pending", { attempt });
      }

      if (
        lastIdentitySync &&
        lastIdentitySync.key === syncKey &&
        lastIdentitySync.tagsSignature === tagsSig
      ) {
        recordPushDiagnosticEvent("identity_sync_deduplicated", {
          externalId,
          reason: "tags_unchanged_after_login",
        });
      } else if (
        oneSignalApi.User &&
        typeof oneSignalApi.User.addTags === "function"
      ) {
        recordPushDiagnosticEvent("tags_sync_started", {
          externalId,
          tagsSignature: tagsSig,
          attempt,
        });
        setPushLifecycleStage("tags_sync_started");
        // Aguardar login antes das tags — evita 409 por corrida.
        oneSignalApi.User.addTags(tags);
        recordPushDiagnosticEvent("tags_sync_completed", {
          externalId,
          tagsSignature: tagsSig,
          attempt,
        });
      }

      if (remoteConfirmed) {
        lastIdentitySync = {
          key: syncKey,
          tagsSignature: tagsSig,
          externalId,
          remoteConfirmed: true,
          completedAt: Date.now(),
        };
      }
      setPushLifecycleStage("tags_completed");
      setPushStatus({
        externalUserId: remoteConfirmed ? externalId : null,
      });
      return { ok: true, externalId, attempt, remoteConfirmed };
    } catch (e) {
      const typed = classifyInvalidTokenDeviceTypeError(e);
      if (typed) {
        recordPushDiagnosticEvent("onesignal_invalid_token_device_type", {
          ...typed,
          loginAttempt: attempt,
          endpointHost: getLastStabilityMeta()?.endpointHost || null,
        });
        setPushStatus({
          errorCode: "onesignal_invalid_token_device_type",
        });
      }
      const stage =
        e?.message === "subscription_stability_timeout"
          ? "stability_timeout"
          : e?.message === "identity_login_timeout"
            ? "identity_login_timeout"
            : e?.message === "external_id_would_be_company_id"
              ? "identity_login_failed"
              : identityUserId === externalId
                ? "tags_sync_failed"
                : "identity_login_failed";
      recordPushDiagnosticEvent(stage, {
        error: e,
        externalId,
        companyIdTag,
        attempt,
        typedError: typed?.code || null,
      });
      if (
        stage === "identity_login_failed" ||
        stage === "identity_login_timeout" ||
        stage === "stability_timeout"
      ) {
        logPush(stage, { message: e?.message || "unknown" });
      } else {
        recordPushDiagnosticEvent("tags_sync_failed", {
          error: e,
          attempt,
        });
      }
      setPushLifecycleStage(stage);
      // Falha limpa o in-flight para permitir retry; não marca lastIdentitySync.
      throw e;
    } finally {
      if (identitySyncInFlightKey === syncKey) {
        identitySyncInFlight = null;
        identitySyncInFlightKey = null;
      }
    }
  })();

  return identitySyncInFlight;
}

function invalidateIdentitySyncCache() {
  identitySyncInFlight = null;
  identitySyncInFlightKey = null;
  lastIdentitySync = null;
  identityUserId = null;
  stabilityWaitInFlight = null;
  lastAnonymousProbe = null;
}

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Associa External ID ao SDK (idempotente, com retry limitado).
 * Não marca sincronização como OK se login falhar.
 * @returns {Promise<{ ok: boolean, reason?: string, externalId?: string, attempts?: number }>}
 */
export async function syncOneSignalUser(user, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 3);
  const baseDelayMs = Math.max(100, Number(options.baseDelayMs) || 750);
  const externalId = resolveOneSignalExternalId(user);
  if (!externalId) {
    return { ok: false, reason: "missing_user_id", attempts: 0 };
  }

  let lastResult = { ok: false, reason: "not_attempted", externalId, attempts: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = { ...lastResult, attempts: attempt };
    try {
      if (attempt > 1) {
        recordPushDiagnosticEvent("identity_sync_retry", {
          externalId,
          attempt,
          maxAttempts,
        });
      }
      const cfg = await fetchPublicPushConfig();
      if (!cfg.onesignalEnabled || !cfg.onesignalAppId) {
        return { ok: false, reason: "push_disabled", externalId, attempts: attempt };
      }
      const ok = await initOneSignalFromConfig(cfg);
      if (!ok || !oneSignalApi) {
        lastResult = {
          ok: false,
          reason: "sdk_not_ready",
          externalId,
          attempts: attempt,
        };
        if (attempt < maxAttempts) {
          await delayMs(baseDelayMs * 2 ** (attempt - 1));
        }
        continue;
      }
      // Após falha anterior (ex.: stability timeout pós-logout), tentar login
      // sem bloquear de novo no wait completo — association first.
      const result = await applyUserIdentity(user, {
        skipStabilityWait: attempt > 1,
      });
      if (result?.ok) {
        refreshFromSdk();
        recordPushDiagnosticEvent("identity_sync_ok", {
          externalId: result.externalId || externalId,
          attempt,
          deduplicated: Boolean(result.deduplicated),
          deferredLogin: Boolean(result.deferredLogin),
        });
        return {
          ok: true,
          externalId: result.externalId || externalId,
          attempts: attempt,
          deduplicated: Boolean(result.deduplicated),
          deferredLogin: Boolean(result.deferredLogin),
          remoteConfirmed: Boolean(result.remoteConfirmed),
        };
      }
      lastResult = {
        ok: false,
        reason: result?.reason || "identity_failed",
        externalId,
        attempts: attempt,
      };
      invalidateIdentitySyncCache();
    } catch (e) {
      invalidateIdentitySyncCache();
      lastResult = {
        ok: false,
        reason: e?.message || "sync_error",
        externalId,
        attempts: attempt,
      };
      recordPushDiagnosticEvent("identity_sync_retry_failed", {
        externalId,
        attempt,
        reason: lastResult.reason,
      });
    }
    if (attempt < maxAttempts) {
      await delayMs(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  recordPushDiagnosticEvent("identity_sync_exhausted", {
    externalId,
    reason: lastResult.reason,
    attempts: lastResult.attempts,
  });
  return lastResult;
}

export async function oneSignalLogout() {
  recordPushDiagnosticEvent("identity_logout_started", {});
  invalidateIdentitySyncCache();
  if (!oneSignalApi || !oneSignalReady) {
    setPushStatus({ externalUserId: null });
    recordPushDiagnosticEvent("identity_logout_completed", {
      reason: "sdk_not_ready",
    });
    return;
  }
  try {
    await oneSignalApi.logout();
    recordPushDiagnosticEvent("identity_logout_completed", { ok: true });
  } catch (e) {
    recordPushDiagnosticEvent("identity_logout_completed", {
      ok: false,
      reason: e?.message || "logout_error",
    });
  } finally {
    invalidateIdentitySyncCache();
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
      const cfg = await withTimeout(
        fetchPublicPushConfig(),
        PUSH_CONFIG_WAIT_MS,
        "push_config_timeout"
      );
      if (!cfg.onesignalEnabled || !cfg.onesignalAppId) {
        const status = setPushStatus({
          onesignalEnabled: false,
          onesignalAppId: "",
          subscribing: false,
          errorCode: "not_configured",
        });
        return { ok: false, domainState: status.domainState, errorCode: "not_configured", status };
      }

      const ok = await withTimeout(
        initOneSignalFromConfig(cfg),
        INIT_WAIT_MS,
        "init_timeout"
      );
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
          ...subscriptionFieldsForStatus(before),
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

      let confirmed;
      let permAfter = readNativePermission();
      try {
        recordPushDiagnosticEvent("permission_requested");
        confirmed = await settlePushSubscriptionAfterOptIn(oneSignalApi, pushSub);
        permAfter = readNativePermission();
        setPushStatus({ permissionNative: permAfter });
        if (permAfter === "granted") {
          logPush("permission_granted");
          recordPushDiagnosticEvent("permission_granted");
        }
      } catch (e) {
        permAfter = readNativePermission();
        if (permAfter === "denied") {
          logPush("permission_denied");
          const status = setPushStatus({
            permissionNative: "denied",
            subscribing: false,
            errorCode: "permission_denied",
          });
          return { ok: false, domainState: status.domainState, errorCode: "permission_denied", status };
        }
        if (e?.message !== "subscription_missing_after_permission") {
          const status = setPushStatus({
            permissionNative: permAfter,
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
          confirmed = await settlePushSubscriptionAfterOptIn(oneSignalApi, pushSub);
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
          await applyUserIdentity(user, {
            confirmedStableSnapshot: confirmed.stableSnapshot || null,
          });
        } catch {
          /* subscription ok; identidade pode falhar temporariamente */
        }
      }

      const status = setPushStatus({
        subscribing: false,
        errorCode: null,
        permissionNative: readNativePermission(),
        ...subscriptionFieldsForStatus(confirmed),
      });
      return { ok: true, domainState: status.domainState, status };
    } catch (e) {
      const errorCode =
        e?.message === "push_config_timeout"
          ? "push_config_timeout"
          : e?.message === "init_timeout"
            ? "init_failed"
            : "opt_in_failed";
      logPush(errorCode, { message: e?.message || "unknown" });
      const status = setPushStatus({
        subscribing: false,
        errorCode,
        permissionNative: readNativePermission(),
      });
      return { ok: false, domainState: status.domainState, errorCode, status };
    } finally {
      if (pushStatus.subscribing) {
        setPushStatus({ subscribing: false });
      }
      logPush("subscribing_finished", {
        domainState: pushStatus.domainState,
        errorCode: pushStatus.errorCode,
      });
      recordPushDiagnosticEvent("subscribing_finished", {
        domainState: pushStatus.domainState,
        errorCode: pushStatus.errorCode,
      });
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
  let liveSnap = null;
  try {
    if (oneSignalApi) {
      liveSnap = await buildSanitizedSubscriptionSnapshot(oneSignalApi, "diagnostics");
    }
  } catch {
    liveSnap = null;
  }
  const base = await buildOneSignalPushDiagnostics({
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
  return {
    ...base,
    sdkVersion: liveSnap?.sdkVersion || null,
    identitySync: {
      attempt: identitySyncAttempt,
      inFlight: Boolean(identitySyncInFlight),
      lastExternalId: lastIdentitySync?.externalId || identityUserId,
      lastTagsSignature: lastIdentitySync?.tagsSignature || null,
      supportModeNote:
        "External ID = utilizador autenticado da sessão; companyId do tenant é só tag.",
    },
    stability: {
      ...getLastStabilityMeta(),
      snapshotChangesCount: getSnapshotChangesCount(),
      live: liveSnap
        ? {
            signature: liveSnap.signature,
            optedIn: liveSnap.optedIn,
            enabled: liveSnap.enabled,
            notificationTypes: liveSnap.notificationTypes,
            maskedSubscriptionId: liveSnap.maskedSubscriptionId,
            tokenHash: liveSnap.tokenHash,
            endpointHost: liveSnap.endpointHost,
            webAuthHash: liveSnap.webAuthHash,
            webP256Hash: liveSnap.webP256Hash,
            onesignalWorkerState: liveSnap.onesignalWorkerState,
            blocksLogin: liveSnap.blocksLogin,
            browser: liveSnap.browser,
          }
        : null,
    },
    anonymousProbe: lastAnonymousProbe,
    sdkPinning: {
      supportedOfficially: false,
      loadedFrom:
        "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js → page.es6.js?v=160609",
      workerFrom:
        "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js (160609)",
      note:
        "OneSignal recomenda CDN /v16/ sem pin; pinning não implementado nesta fase.",
    },
  };
}

/**
 * Modo diagnóstico controlado (dev ou Super Admin em supportMode):
 * captura snapshot estável sem chamar login.
 */
export function setOneSignalDeferLoginForProbe(enabled, user) {
  if (!enabled) {
    deferLoginForProbe = false;
    return true;
  }
  if (!isAnonymousStabilityProbeAllowed(user)) {
    deferLoginForProbe = false;
    return false;
  }
  deferLoginForProbe = true;
  return true;
}

export function getOneSignalAnonymousProbe() {
  return lastAnonymousProbe ? { ...lastAnonymousProbe } : null;
}

/**
 * Após probe anónimo: executa login+tags normalmente.
 */
export async function completeOneSignalLoginAfterProbe(user) {
  deferLoginForProbe = false;
  invalidateIdentitySyncCache();
  return applyUserIdentity(user, { skipStabilityWait: false });
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
export function __setPushWaitMsForTests(subscriptionMs, permissionMs, loginMs) {
  SUBSCRIPTION_WAIT_MS =
    subscriptionMs != null ? subscriptionMs : SUBSCRIPTION_WAIT_MS_DEFAULT;
  PERMISSION_WAIT_MS =
    permissionMs != null ? permissionMs : PERMISSION_WAIT_MS_DEFAULT;
  LOGIN_WAIT_MS = loginMs != null ? loginMs : LOGIN_WAIT_MS_DEFAULT;
}

export function __resetOneSignalServiceForTests() {
  oneSignalApi = null;
  initPromise = null;
  oneSignalReady = false;
  sdkLoading = false;
  lastConfig = null;
  statusListenersAttached = false;
  enableInFlight = null;
  deferLoginForProbe = false;
  lastAnonymousProbe = null;
  invalidateIdentitySyncCache();
  identitySyncAttempt = 0;
  SUBSCRIPTION_WAIT_MS = SUBSCRIPTION_WAIT_MS_DEFAULT;
  PERMISSION_WAIT_MS = PERMISSION_WAIT_MS_DEFAULT;
  LOGIN_WAIT_MS = LOGIN_WAIT_MS_DEFAULT;
  REMOTE_CONFIRM_ATTEMPTS = 1;
  REMOTE_CONFIRM_INTERVAL_MS = 0;
  statusListeners.clear();
  __resetPushDiagnosticsForTests();
  __resetStabilityStateForTests();
  // Timing acelerado em testes unitários (produção usa defaults do módulo).
  __setStabilityTimingForTests({
    pollMs: 15,
    requiredMatches: 2,
    minWindowMs: 30,
    timeoutMs: 800,
  });
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

export function __setStabilityTimingForServiceTests(timing) {
  __setStabilityTimingForTests(timing);
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
