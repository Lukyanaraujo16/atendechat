/**
 * Coordenação multi-aba: apenas a aba líder toca som e emite notificação nativa.
 * Badges/título podem atualizar em todas as abas.
 */

const STORAGE_KEY = "atendechat:notification-tab-leader";
const CHANNEL_NAME = "atendechat:notification-leader";
const HEARTBEAT_MS = 2000;
const STALE_MS = 5000;

function createTabId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLeader() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLeader(id) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id, at: Date.now() })
    );
  } catch {
    /* ignore quota */
  }
}

let tabId = null;
let isLeader = false;
let heartbeatTimer = null;
let channel = null;
let listeners = new Set();
let started = false;
let onStorageHandler = null;

function emitChange() {
  listeners.forEach((fn) => {
    try {
      fn(isLeader);
    } catch {
      /* ignore */
    }
  });
}

function setLeaderFlag(next) {
  if (isLeader === next) return;
  isLeader = next;
  emitChange();
}

function tryClaim() {
  if (typeof localStorage === "undefined") {
    setLeaderFlag(true);
    return;
  }
  const now = Date.now();
  const current = readLeader();
  if (
    !current ||
    current.id === tabId ||
    now - Number(current.at) > STALE_MS
  ) {
    writeLeader(tabId);
    setLeaderFlag(true);
    if (channel) {
      try {
        channel.postMessage({ type: "claim", id: tabId, at: now });
      } catch {
        /* ignore */
      }
    }
    return;
  }
  setLeaderFlag(false);
}

function onHeartbeat() {
  if (isLeader) {
    writeLeader(tabId);
    return;
  }
  tryClaim();
}

function stopLeaderInternals({ removeLeaderKeyAlways = false } = {}) {
  if (typeof window !== "undefined" && onStorageHandler) {
    window.removeEventListener("storage", onStorageHandler);
    onStorageHandler = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (channel) {
    try {
      channel.close();
    } catch {
      /* ignore */
    }
    channel = null;
  }
  const current = readLeader();
  if (removeLeaderKeyAlways || current?.id === tabId) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  started = false;
  setLeaderFlag(false);
  listeners.clear();
}

/**
 * Inicia eleição de líder. Idempotente. Retorna cleanup.
 */
export function initNotificationTabLeader() {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (started) {
    return () => {};
  }
  started = true;
  tabId = createTabId();

  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event?.data;
        if (!data || data.type !== "claim") return;
        if (data.id === tabId) return;
        if (Number(data.at) >= (readLeader()?.at || 0)) {
          setLeaderFlag(false);
        }
      };
    }
  } catch {
    channel = null;
  }

  onStorageHandler = (event) => {
    if (event.key !== STORAGE_KEY) return;
    const current = readLeader();
    setLeaderFlag(Boolean(current && current.id === tabId));
  };

  window.addEventListener("storage", onStorageHandler);
  tryClaim();
  heartbeatTimer = setInterval(onHeartbeat, HEARTBEAT_MS);

  return () => {
    if (!started) return;
    stopLeaderInternals({ removeLeaderKeyAlways: false });
  };
}

/**
 * Encerra liderança/canal/timers mesmo se o cleanup do provider ainda não rodou
 * (ex.: logout). Permite reiniciar em login seguinte.
 */
export function forceStopNotificationTabLeader() {
  if (typeof window === "undefined") {
    return;
  }
  if (!started) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  stopLeaderInternals({ removeLeaderKeyAlways: true });
}

export function isNotificationTabLeader() {
  if (typeof window === "undefined") return true;
  if (!started) return true;
  return isLeader;
}

export function subscribeNotificationTabLeader(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotificationTabId() {
  return tabId;
}

/** @deprecated test helper */
export function __resetNotificationTabLeaderForTests() {
  forceStopNotificationTabLeader();
  tabId = null;
}
