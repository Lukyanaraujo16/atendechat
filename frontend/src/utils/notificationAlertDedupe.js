/**
 * Dedupe de alertes (som / notificação nativa) por ID estável de mensagem.
 * Janela limitada para evitar crescimento infinito.
 */

const DEFAULT_TTL_MS = 90 * 1000;
const DEFAULT_MAX = 500;

const seen = new Map();

function prune(now = Date.now()) {
  for (const [key, expiresAt] of seen.entries()) {
    if (expiresAt <= now) {
      seen.delete(key);
    }
  }
  if (seen.size <= DEFAULT_MAX) return;
  const ordered = [...seen.entries()].sort((a, b) => a[1] - b[1]);
  const overflow = seen.size - DEFAULT_MAX;
  for (let i = 0; i < overflow; i += 1) {
    seen.delete(ordered[i][0]);
  }
}

/**
 * Tenta registrar o ID. Retorna true se é a primeira vez (deve alertar).
 */
export function claimNotificationAlertId(id, ttlMs = DEFAULT_TTL_MS) {
  if (id == null || id === "") return false;
  const key = String(id);
  const now = Date.now();
  prune(now);
  if (seen.has(key) && seen.get(key) > now) {
    return false;
  }
  seen.set(key, now + ttlMs);
  return true;
}

export function hasNotificationAlertId(id) {
  if (id == null || id === "") return false;
  const key = String(id);
  const expiresAt = seen.get(key);
  return Boolean(expiresAt && expiresAt > Date.now());
}

export function clearNotificationAlertDedupe() {
  seen.clear();
}

export function __notificationAlertDedupeSizeForTests() {
  prune();
  return seen.size;
}
