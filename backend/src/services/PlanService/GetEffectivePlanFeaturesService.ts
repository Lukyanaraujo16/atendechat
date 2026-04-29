import Plan from "../../models/Plan";
import PlanFeature from "../../models/PlanFeature";
import { getAllFeatureKeys } from "../../config/features";
import {
  legacyPlanFeatureValue,
  planLegacyColumnsIndicateFullAccess
} from "../../config/planFeatureLegacy";
import { resolvePlanIdForQuery, logPlanFeaturesWarn } from "./planIdResolve";

export type PersistedPlanFeatureMap = Record<string, boolean>;

export {
  resolvePlanIdForQuery,
  getPlanIdFromContext,
  PLAN_FEATURES_LOG_TAG,
  logPlanFeaturesWarn,
  logPlanFeaturesInfo,
  resolvePlanIdForFeatures,
  getPlanIdFromAny
} from "./planIdResolve";

/** Garante objeto para overrides vindos de JSONB / string JSON. */
export function coerceModulePermissionsFromRow(
  raw: unknown
): Record<string, boolean> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "" || t === "null") return undefined;
    try {
      const p = JSON.parse(t) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, boolean>;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, boolean>;
  }
  return undefined;
}

export async function loadPersistedPlanFeatureMap(
  planId: number | string | null | undefined
): Promise<PersistedPlanFeatureMap> {
  const resolved = resolvePlanIdForQuery(planId);
  if (resolved == null) {
    logPlanFeaturesWarn("skip load: missing or invalid planId (no query)", {
      planIdRaw: planId,
      resolved: null
    });
    return {};
  }

  const rows = await PlanFeature.findAll({
    where: { planId: resolved },
    attributes: ["featureKey", "enabled"]
  });
  const persisted: PersistedPlanFeatureMap = {};
  for (const r of rows) {
    persisted[r.featureKey] = r.enabled === true;
  }
  return persisted;
}

function applyLegacyModulePermissionGates(
  modulePermissions: Record<string, boolean | undefined>,
  featureKey: string,
  base: boolean
): boolean {
  const m = modulePermissions || {};
  if (!base) return false;
  const off = (k: string) => m[k] === false;

  if (off("useKanban") && featureKey === "attendance.kanban") return false;
  if (off("useInternalChat") && featureKey === "attendance.internal_chat") return false;
  if (off("useOpenAi") && featureKey === "automation.openai") return false;
  if (off("useIntegrations") && featureKey === "automation.integrations") return false;
  if (
    off("useSchedules") &&
    (featureKey === "agenda.appointments" || featureKey === "attendance.schedules")
  ) {
    return false;
  }
  if (off("useExternalApi") && featureKey === "settings.api") return false;
  if (off("useGroups") && featureKey === "team.groups") return false;

  if (off("useCampaigns")) {
    if (
      featureKey === "campaigns.sends" ||
      featureKey === "campaigns.lists" ||
      featureKey === "automation.keywords" ||
      featureKey === "automation.quick_replies"
    ) {
      return false;
    }
  }
  if (off("useFlowbuilders") && featureKey === "automation.chatbot") return false;

  return true;
}

/** Valor efetivo: PlanFeatures → senão legado; depois override false na empresa. */
export function resolvePlanFeature(
  plan: Plan | Record<string, unknown> | null | undefined,
  persistedMap: PersistedPlanFeatureMap,
  modulePermissions: unknown,
  featureKey: string
): boolean {
  const perms = coerceModulePermissionsFromRow(modulePermissions) ?? {};
  if (perms[featureKey] === false) return false;
  let v: boolean;
  if (Object.prototype.hasOwnProperty.call(persistedMap, featureKey)) {
    v = persistedMap[featureKey] === true;
  } else {
    v = legacyPlanFeatureValue(plan, featureKey);
  }
  return applyLegacyModulePermissionGates(perms, featureKey, v);
}

export function getEffectivePlanFeaturesMap(
  plan: Plan | Record<string, unknown> | null | undefined,
  persistedMap: PersistedPlanFeatureMap,
  modulePermissions: unknown
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const nPersist = Object.keys(persistedMap).length;
  const nTruePersist = Object.values(persistedMap).filter((x) => x === true).length;
  const trueRatio = nPersist > 0 ? nTruePersist / nPersist : 0;
  const corruptedPersisted =
    Boolean(plan) &&
    planLegacyColumnsIndicateFullAccess(plan) &&
    nPersist > 0 &&
    trueRatio < 0.12;

  const effectivePersisted = corruptedPersisted ? {} : persistedMap;

  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = resolvePlanFeature(plan, effectivePersisted, modulePermissions, k);
  }
  return out;
}

/** Mapa ao nível do plano (sem override de empresa) — para edição no Super Admin. */
export function mergePlanPersistedWithLegacy(
  plan: Plan,
  rows: PlanFeature[]
): Record<string, boolean> {
  const persisted: PersistedPlanFeatureMap = {};
  for (const r of rows) {
    persisted[r.featureKey] = r.enabled === true;
  }
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(persisted, k)) {
      out[k] = persisted[k];
    } else {
      out[k] = legacyPlanFeatureValue(plan, k);
    }
  }
  return out;
}
