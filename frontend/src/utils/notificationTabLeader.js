/**
 * Coordenação multi-aba: apenas a aba líder toca som e emite notificação nativa.
 * Badges/título podem atualizar em todas as abas.
 */

const LEGACY_STORAGE_KEY = "atendechat:notification-tab-leader";
const CHANNEL_PREFIX = "atendechat:notification-leader";
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

export function buildNotificationLeaderStorageKey(companyId, userId) {
  const c =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId)
      : typeof localStorage !== "undefined"
        ? localStorage.getItem("companyId") || "none"
        : "none";
  const u =
    userId != null && String(userId).trim() !== ""
      ? String(userId)
      : typeof localStorage !== "undefined"
        ? localStorage.getItem("userId") || "anon"
        : "anon";
  return `${LEGACY_STORAGE_KEY}:${c}:${u}`;
}

function buildChannelName(storageKey) {
  return `${CHANNEL_PREFIX}:${storageKey}`;
}

let storageKey = LEGACY_STORAGE_KEY;
let channelName = CHANNEL_PREFIX;
let tabId = null;
let isLeader = false;
let heartbeatTimer = null;
let channel = null;
let listeners = new Set();
let started = false;
let onStorageHandler = null;

function readLeader() {
  try {
    const raw = localStorage.getItem(storageKey);
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
      storageKey,
      JSON.stringify({ id, at: Date.now() })
    );
  } catch {
    /* ignore quota */
  }
}

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

function clearLeaderKeys() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
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
    clearLeaderKeys();
  }
  started = false;
  setLeaderFlag(false);
  listeners.clear();
}

/**
 * Inicia eleição de líder. Escopo por empresa/usuário.
 * Retorna cleanup.
 */
export function initNotificationTabLeader(scope = {}) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const nextKey = buildNotificationLeaderStorageKey(
    scope.companyId,
    scope.userId
  );

  if (started && storageKey === nextKey) {
    return () => {};
  }

  if (started) {
    stopLeaderInternals({ removeLeaderKeyAlways: true });
  }

  storageKey = nextKey;
  channelName = buildChannelName(nextKey);
  started = true;
  tabId = createTabId();

  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(channelName);
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
    if (event.key !== storageKey) return;
    const current = readLeader();
    // Sem líder válido / chave limpa → esta aba tenta assumir (fallback).
    if (!current) {
      tryClaim();
      return;
    }
    setLeaderFlag(Boolean(current.id === tabId));
  };

  window.addEventListener("storage", onStorageHandler);
  tryClaim();
  // Sem BroadcastChannel, heartbeat ainda elege via localStorage.
  heartbeatTimer = setInterval(onHeartbeat, HEARTBEAT_MS);

  return () => {
    if (!started) return;
    stopLeaderInternals({ removeLeaderKeyAlways: false });
  };
}

/**
 * Encerra liderança/canal/timers (logout). Permite reinício no login seguinte.
 */
export function forceStopNotificationTabLeader() {
  if (typeof window === "undefined") {
    return;
  }
  if (!started) {
    clearLeaderKeys();
    return;
  }
  stopLeaderInternals({ removeLeaderKeyAlways: true });
}

export function isNotificationTabLeader() {
  if (typeof window === "undefined") return true;
  if (!started) return true;
  // Fallback: se a chave sumiu/expirou, tentar assumir em vez de silenciar.
  const current = typeof localStorage !== "undefined" ? readLeader() : null;
  if (!current || Date.now() - Number(current.at) > STALE_MS) {
    tryClaim();
  }
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
  storageKey = LEGACY_STORAGE_KEY;
  channelName = CHANNEL_PREFIX;
}
