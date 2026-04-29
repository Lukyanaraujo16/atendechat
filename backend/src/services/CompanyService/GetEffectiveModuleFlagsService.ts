import Plan from "../../models/Plan";
import { buildDefaultFeatureMapFromPlan } from "../../config/planFeatureLegacy";
import { coerceModulePermissionsFromRow } from "../PlanService/GetEffectivePlanFeaturesService";

export type ModulePermissionsMap = Record<string, boolean | undefined> | null | undefined;

/** Flags efetivas após aplicar plano + overrides da empresa (false explícito bloqueia). */
export type EffectiveModuleFlags = {
  useKanban: boolean;
  useCampaigns: boolean;
  useFlowbuilders: boolean;
  useOpenAi: boolean;
  useSchedules: boolean;
  useExternalApi: boolean;
  useIntegrations: boolean;
  useGroups: boolean;
  useInternalChat: boolean;
};

/**
 * Flags “legadas” derivadas do mapa granular (plano + PlanFeatures + overrides).
 * - useCampaigns: só disparos/listas (não inclui chatbot isolado).
 * - useFlowbuilders: automation.chatbot respeitando override useFlowbuilders.
 */
export function buildEffectiveModuleFlagsFromFeatureMap(
  featureMap: Record<string, boolean>,
  modulePermissions: ModulePermissionsMap | unknown
): EffectiveModuleFlags {
  const m = coerceModulePermissionsFromRow(modulePermissions) || {};
  return {
    useKanban: featureMap["attendance.kanban"] === true,
    useCampaigns:
      featureMap["campaigns.sends"] === true || featureMap["campaigns.lists"] === true,
    useFlowbuilders:
      featureMap["automation.chatbot"] === true && m.useFlowbuilders !== false,
    useOpenAi: featureMap["automation.openai"] === true,
    useSchedules:
      featureMap["agenda.appointments"] === true ||
      featureMap["attendance.schedules"] === true,
    useExternalApi: featureMap["settings.api"] === true,
    useIntegrations: featureMap["automation.integrations"] === true,
    useGroups: featureMap["team.groups"] === true && m.useGroups !== false,
    useInternalChat: featureMap["attendance.internal_chat"] === true
  };
}

/**
 * Sem linhas PlanFeatures no pedido: reconstrói o mapa só a partir das colunas do Plan (legado).
 */
const GetEffectiveModuleFlags = (
  plan: Plan | null | undefined,
  modulePermissions: ModulePermissionsMap
): EffectiveModuleFlags => {
  const featureMap = buildDefaultFeatureMapFromPlan(plan);
  return buildEffectiveModuleFlagsFromFeatureMap(featureMap, modulePermissions);
};

export default GetEffectiveModuleFlags;
