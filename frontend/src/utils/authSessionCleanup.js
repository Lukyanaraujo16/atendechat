/**
 * Limpeza local de sessão (credenciais + efeitos colaterais da conta).
 * Isolada para testes e para o fluxo de logout resiliente.
 */

import { forceStopNotificationTabLeader } from "./notificationTabLeader";
import {
  buildGlobalNotificationsStorageKey,
  clearGlobalNotificationsStorage,
} from "./globalNotificationsStorage";

export const AUTH_STORAGE_KEYS = [
  "token",
  "companyId",
  "userId",
  "cshow",
  "companyDueDate",
];

const NOTIFICATION_LEADER_KEY = "atendechat:notification-tab-leader";
export const AUTH_LOGOUT_BROADCAST_KEY = "atendechat:auth-logout";

export function clearAuthCredentialsFromStorage() {
  if (typeof localStorage === "undefined") return;
  AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

export function clearNotificationSessionArtifacts() {
  forceStopNotificationTabLeader();
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(NOTIFICATION_LEADER_KEY);
  } catch {
    /* ignore */
  }
  try {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");
    if (companyId || userId) {
      const scoped = `atendechat:notification-tab-leader:${companyId || "none"}:${userId || "anon"}`;
      localStorage.removeItem(scoped);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Limpa cache de notificações da conta que está saindo (antes de remover userId/companyId).
 */
export function clearCurrentUserNotificationCache() {
  if (typeof localStorage === "undefined") return;
  try {
    const userId = localStorage.getItem("userId");
    const companyId = localStorage.getItem("companyId");
    const key = buildGlobalNotificationsStorageKey(userId, companyId);
    if (key) {
      clearGlobalNotificationsStorage(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sinaliza outras abas (storage event) sem embutir token.
 */
export function broadcastAuthLogout() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUTH_LOGOUT_BROADCAST_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isForeignTabLogoutEvent(event) {
  if (!event) return false;
  if (event.key === "token" && event.oldValue && !event.newValue) {
    return true;
  }
  if (event.key === AUTH_LOGOUT_BROADCAST_KEY && event.newValue) {
    return true;
  }
  return false;
}

export function withTimeout(promise, ms, label = "timeout") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(label));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
