/**
 * Controle de notificações UI/som quando a aba está em background ou ao restaurar
 * após minimizar (eventos socket processados em lote).
 */

export const BACKGROUND_SUMMARY_TOAST_ID = "background-notifications-summary";
export const BACKGROUND_BATCH_WINDOW_MS = 1500;
export const NOTIFICATION_SOUND_THROTTLE_MS = 3000;

const isDebugEnabled = () =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem("DEBUG_NOTIFICATIONS") === "1";

function debug(...args) {
  if (isDebugEnabled()) {
    console.info("[notifications:visibility]", ...args);
  }
}

const state = {
  isPageVisible: true,
  lastHiddenAt: null,
  lastVisibleAt: Date.now(),
  batchingUntil: 0,
  flushTimer: null,
};

const queue = {
  count: 0,
  messageIds: new Set(),
};

let lastSoundPlayedAt = 0;
let flushHandlers = null;

export function isPageInForeground() {
  if (typeof document === "undefined") return true;
  return !document.hidden;
}

export function shouldDeferUiNotification() {
  if (typeof document === "undefined") return false;
  if (document.hidden) return true;
  if (Date.now() < state.batchingUntil) return true;
  return false;
}

export function registerNotificationFlushHandlers(handlers) {
  flushHandlers = handlers;
}

export function queueBackgroundNotification({ messageId } = {}) {
  if (messageId != null && messageId !== "") {
    const key = String(messageId);
    if (queue.messageIds.has(key)) {
      debug("dedupe skip", key);
      return false;
    }
    queue.messageIds.add(key);
  }
  queue.count += 1;
  debug("queued", { count: queue.count, messageId });
  return true;
}

function resetQueue() {
  queue.count = 0;
  queue.messageIds.clear();
}

function canPlayThrottledSound() {
  const now = Date.now();
  if (now - lastSoundPlayedAt < NOTIFICATION_SOUND_THROTTLE_MS) {
    debug("sound throttled");
    return false;
  }
  lastSoundPlayedAt = now;
  return true;
}

export function flushDeferredNotifications() {
  state.batchingUntil = 0;
  const count = queue.count;
  if (count <= 0) {
    debug("flush skipped, empty queue");
    return;
  }

  debug("flushing", count);
  resetQueue();

  if (flushHandlers?.playSound && canPlayThrottledSound()) {
    flushHandlers.playSound();
    debug("sound played");
  }

  if (flushHandlers?.showSummaryToast) {
    flushHandlers.showSummaryToast(count);
    debug("summary toast shown", count);
  }
}

function scheduleFlushAfterBatchWindow() {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }
  const delay = Math.max(0, state.batchingUntil - Date.now());
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    flushDeferredNotifications();
  }, delay);
}

function onBecameVisible() {
  state.isPageVisible = true;
  state.lastVisibleAt = Date.now();
  state.batchingUntil = Date.now() + BACKGROUND_BATCH_WINDOW_MS;
  debug("visible", { batchingUntil: state.batchingUntil });
  scheduleFlushAfterBatchWindow();
}

function onBecameHidden() {
  state.isPageVisible = false;
  state.lastHiddenAt = Date.now();
  debug("hidden");
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
}

/**
 * Inicializa listeners de visibilidade/foco. Retorna cleanup.
 */
export function initPageVisibilityNotifications() {
  if (typeof document === "undefined") {
    return () => {};
  }

  state.isPageVisible = !document.hidden;
  state.lastVisibleAt = Date.now();

  const onVisibilityChange = () => {
    if (document.hidden) {
      onBecameHidden();
    } else {
      onBecameVisible();
    }
  };

  const onWindowFocus = () => {
    if (!document.hidden) {
      onBecameVisible();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onWindowFocus);

  debug("init", { visible: state.isPageVisible });

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", onWindowFocus);
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
  };
}
