import Plan from "../../models/Plan";
import PlanFeature from "../../models/PlanFeature";
import { getAllFeatureKeys } from "../../config/features";
import { legacyPlanFeatureValue } from "../../config/planFeatureLegacy";

export type PersistedPlanFeatureMap = Record<string, boolean>;

export async function loadPersistedPlanFeatureMap(
  planId: number
): Promise<PersistedPlanFeatureMap> {
  const rows = await PlanFeature.findAll({
    where: { planId },
    attributes: ["featureKey", "enabled"]
  });
  const persisted: PersistedPlanFeatureMap = {};
  for (const r of rows) {
    persisted[r.featureKey] = r.enabled === true;
  }
  return persisted;
}

function applyLegacyModulePermissionGates(
  modulePermissions: Record<string, boolean> | null | undefined,
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
  plan: Plan | null | undefined,
  persistedMap: PersistedPlanFeatureMap,
  modulePermissions: Record<string, boolean> | null | undefined,
  featureKey: string
): boolean {
  const m = modulePermissions || {};
  if (m[featureKey] === false) return false;
  let v: boolean;
  if (Object.prototype.hasOwnProperty.call(persistedMap, featureKey)) {
    v = persistedMap[featureKey] === true;
  } else {
    v = legacyPlanFeatureValue(plan, featureKey);
  }
  return applyLegacyModulePermissionGates(modulePermissions, featureKey, v);
}

export function getEffectivePlanFeaturesMap(
  plan: Plan | null | undefined,
  persistedMap: PersistedPlanFeatureMap,
  modulePermissions: Record<string, boolean> | null | undefined
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = resolvePlanFeature(plan, persistedMap, modulePermissions, k);
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
