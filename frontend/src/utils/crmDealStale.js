/** Limites em ms: até 24h normal; >24h warning; >48h danger; >72h critical */
const MS_HOUR = 60 * 60 * 1000;
export const CRM_STALE_MS_24 = 24 * MS_HOUR;
export const CRM_STALE_MS_48 = 48 * MS_HOUR;
export const CRM_STALE_MS_72 = 72 * MS_HOUR;

/**
 * Timestamp de referência para “última atividade” (compatível com legacy sem lastActivityAt).
 */
export function getCrmDealActivityTimestamp(deal) {
  const raw = deal?.lastActivityAt || deal?.updatedAt || deal?.createdAt;
  if (!raw) return Date.now();
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

/** Referência para tempo “nesta etapa”: histórico real (`currentStageEnteredAt`) ou última atividade. */
export function getCrmDealStageAvgReferenceMs(deal) {
  const row = deal?.currentStageEnteredAt;
  if (row) {
    const t = new Date(row).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return getCrmDealActivityTimestamp(deal);
}

/**
 * Ms desde a última actividade até "agora" (para deals abertos).
 */
export function getCrmDealIdleMs(deal, nowMs = Date.now()) {
  return Math.max(0, nowMs - getCrmDealActivityTimestamp(deal));
}

/**
 * Nível de atraso para cartões em aberto. Fechados → sempre `normal`.
 * @returns {"normal"|"warning"|"danger"|"critical"}
 */
export function getCrmDealStaleLevel(deal, nowMs = Date.now()) {
  if (!deal || deal.status !== "open") return "normal";
  const idle = getCrmDealIdleMs(deal, nowMs);
  if (idle <= CRM_STALE_MS_24) return "normal";
  if (idle <= CRM_STALE_MS_48) return "warning";
  if (idle <= CRM_STALE_MS_72) return "danger";
  return "critical";
}

/** Deal aberto parado mais de thresholdMs? */
export function crmOpenDealIsStaleBeyond(deal, thresholdMs, nowMs = Date.now()) {
  if (!deal || deal.status !== "open") return false;
  return getCrmDealIdleMs(deal, nowMs) > thresholdMs;
}
