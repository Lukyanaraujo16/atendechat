import { logger } from "../../utils/logger";

/** Prefixo único para logs do subsistema de planos / PlanFeatures. */
export const PLAN_FEATURES_LOG_TAG = "[PlanFeatures]" as const;

/**
 * Função única e padronizada para obter um `planId` válido para queries na base de dados.
 * Aceita número, string numérica, ou valores inválidos → sempre `number` (inteiro ≥ 1) ou `null`.
 * Nunca lança; nunca devolve `undefined` nem `NaN`.
 */
export function resolvePlanIdForQuery(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "" || t === "undefined" || t === "null") return null;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const tid = Math.trunc(n);
  if (tid < 1) return null;
  return tid;
}

/**
 * Resolve `planId` a partir de contexto rico: instância Sequelize, plain `company` / `plan`,
 * ou escalar. Ordem: `get("planId")` → `planId` → `plan.id` → objeto que pareça `Plan`.
 */
export function getPlanIdFromContext(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number" || typeof input === "string") {
    return resolvePlanIdForQuery(input);
  }
  if (typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  if (typeof (input as { get?: (k: string) => unknown }).get === "function") {
    try {
      const g = (input as { get: (k: string) => unknown }).get.bind(input);
      const fromGet = resolvePlanIdForQuery(g("planId"));
      if (fromGet != null) return fromGet;
    } catch {
      /* ignore */
    }
  }

  if (obj.planId != null) {
    const p = resolvePlanIdForQuery(obj.planId);
    if (p != null) return p;
  }

  if (obj.plan != null && typeof obj.plan === "object") {
    const pid = resolvePlanIdForQuery((obj.plan as Record<string, unknown>).id);
    if (pid != null) return pid;
  }

  if (
    obj.id != null &&
    ("useKanban" in obj || "useCampaigns" in obj || "useSchedules" in obj)
  ) {
    return resolvePlanIdForQuery(obj.id);
  }

  return null;
}

export function logPlanFeaturesWarn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(
    { tag: PLAN_FEATURES_LOG_TAG, ...meta },
    `${PLAN_FEATURES_LOG_TAG} ${message}`
  );
}

export function logPlanFeaturesInfo(message: string, meta?: Record<string, unknown>): void {
  logger.info(
    { tag: PLAN_FEATURES_LOG_TAG, ...meta },
    `${PLAN_FEATURES_LOG_TAG} ${message}`
  );
}

/** @deprecated usar `resolvePlanIdForQuery` */
export const resolvePlanIdForFeatures = resolvePlanIdForQuery;

/** @deprecated usar `getPlanIdFromContext` */
export const getPlanIdFromAny = getPlanIdFromContext;
