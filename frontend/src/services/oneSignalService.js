import { openApi } from "./api";
import { registerMinimalPwaServiceWorker } from "../serviceWorkerRegistration";

/** Instância do namespace OneSignal após `init` (SDK v16). */
let oneSignalApi = null;

let initPromise = null;
let oneSignalReady = false;

const ONESIGNAL_PAGE_SCRIPT_ID = "onesignal-sdk-page";
const ONESIGNAL_PAGE_SCRIPT_SRC =
  "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

function publicUrlBase() {
  return (process.env.PUBLIC_URL || "").replace(/\/$/, "");
}

function swAsset(file) {
  const base = publicUrlBase();
  return base ? `${base}/${file}` : `/${file}`;
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
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = ONESIGNAL_PAGE_SCRIPT_ID;
    s.src = ONESIGNAL_PAGE_SCRIPT_SRC;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("OneSignal page script failed to load"));
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
        await OneSignal.init(initConfig);
        resolve(OneSignal);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Ao tocar na notificação, abre o ticket (UUID na rota /tickets/:uuid).
 * Dados vêm do payload `data` enviado pela API REST (additionalData no SDK).
 */
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

async function initOneSignalFromConfig(cfg) {
  if (initPromise) {
    return initPromise;
  }
  if (typeof window === "undefined" || !cfg.onesignalAppId) {
    return false;
  }
  const base = publicUrlBase();
  const scope = base ? `${base}/` : "/";
  initPromise = (async () => {
    try {
      await loadOneSignalPageScript();
      const api = await runOneSignalDeferredInit({
        appId: cfg.onesignalAppId,
        allowLocalhostAsSecureOrigin: cfg.onesignalEnvironment === "development",
        serviceWorkerPath: swAsset("OneSignalSDKWorker.js"),
        serviceWorkerUpdaterPath: swAsset("OneSignalSDKUpdaterWorker.js"),
        serviceWorkerParam: { scope },
        autoRegister: false,
      });
      oneSignalApi = api;
      oneSignalReady = true;
      registerTicketDeepLinkOnNotificationClick(api);
      return true;
    } catch {
      oneSignalApi = null;
      oneSignalReady = false;
      initPromise = null;
      return false;
    }
  })();
  return initPromise;
}

/**
 * Arranque: OneSignal OU service worker PWA mínimo (nunca ambos).
 */
export async function bootstrapPushAndPwaServiceWorker() {
  try {
    const cfg = await fetchPublicPushConfig();
    if (cfg.onesignalEnabled && cfg.onesignalAppId) {
      const ok = await initOneSignalFromConfig(cfg);
      if (ok) {
        return "onesignal";
      }
    }
  } catch {
    /* backend indisponível */
  }
  registerMinimalPwaServiceWorker();
  return "pwa";
}

export function isOneSignalReady() {
  return oneSignalReady;
}

export async function syncOneSignalUser(user) {
  if (!user?.id || !oneSignalApi) {
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
    await oneSignalApi.login(String(user.id));
    const companyId = user.companyId ?? localStorage.getItem("companyId") ?? "";
    const queueIds = Array.isArray(user.queues)
      ? user.queues.map((q) => q.id).filter((id) => id != null).join(",")
      : "";
    oneSignalApi.User.addTags({
      user_id: String(user.id),
      company_id: String(companyId),
      profile: String(user.profile || ""),
      queue_ids: queueIds || "none",
    });
  } catch {
    /* falha silenciosa */
  }
}

export async function oneSignalLogout() {
  if (!oneSignalApi || !oneSignalReady) {
    return;
  }
  try {
    await oneSignalApi.logout();
  } catch {
    /* noop */
  }
}

/**
 * Pedido explícito de permissão (ação do utilizador).
 */
export async function requestOneSignalPushPermission() {
  try {
    const cfg = await fetchPublicPushConfig();
    if (!cfg.onesignalEnabled || !cfg.onesignalAppId) {
      return false;
    }
    const ok = await initOneSignalFromConfig(cfg);
    if (!ok || !oneSignalApi) {
      return false;
    }
    return oneSignalApi.Notifications.requestPermission();
  } catch {
    return false;
  }
}
