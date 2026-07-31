/**
 * Notificação desktop in-app (Notifications API) enquanto o StreamHUB estiver
 * aberto (mesmo oculto/minimizado). Não é Web Push com navegador fechado.
 */

const DESKTOP_PREF_KEY = "atendechat:desktopMessageNotifications";

export function isDesktopNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.Notification !== "undefined" &&
    window.Notification != null
  );
}

export function getDesktopNotificationPermission() {
  if (!isDesktopNotificationSupported()) return "unsupported";
  return window.Notification.permission || "default";
}

export function readDesktopNotificationPrefEnabled() {
  try {
    const raw = localStorage.getItem(DESKTOP_PREF_KEY);
    if (raw === "false") return false;
    if (raw === "true") return true;
    return true;
  } catch {
    return true;
  }
}

export function persistDesktopNotificationPrefEnabled(enabled) {
  try {
    localStorage.setItem(DESKTOP_PREF_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

/**
 * Solicita permissão apenas após gesto do usuário.
 * @returns {Promise<"granted"|"denied"|"default"|"unsupported">}
 */
export async function requestDesktopNotificationPermission() {
  if (!isDesktopNotificationSupported()) return "unsupported";
  const NotificationAPI = window.Notification;
  if (NotificationAPI.permission === "granted") return "granted";
  if (NotificationAPI.permission === "denied") return "denied";
  try {
    const result = await NotificationAPI.requestPermission();
    return result || NotificationAPI.permission || "default";
  } catch {
    return NotificationAPI.permission || "default";
  }
}

/**
 * @returns {Notification|null}
 */
export function showDesktopMessageNotification({
  title,
  body,
  icon,
  tag,
  data,
  onClick,
} = {}) {
  if (!isDesktopNotificationSupported()) return null;
  const NotificationAPI = window.Notification;
  if (NotificationAPI.permission !== "granted") return null;
  if (!readDesktopNotificationPrefEnabled()) return null;

  try {
    const notification = new NotificationAPI(title || "Nova mensagem", {
      body: body || "",
      icon: icon || undefined,
      tag: tag || undefined,
      renotify: Boolean(tag),
      data: data || {},
      silent: false,
    });

    notification.onclick = (event) => {
      try {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (typeof window !== "undefined") {
          window.focus();
        }
        if (typeof onClick === "function") {
          onClick(data || {});
        }
        notification.close();
      } catch {
        try {
          notification.close();
        } catch {
          /* ignore */
        }
      }
    };

    return notification;
  } catch {
    return null;
  }
}
