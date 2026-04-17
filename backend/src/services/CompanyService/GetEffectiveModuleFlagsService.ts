import Plan from "../../models/Plan";

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

const asBool = (v: unknown): boolean => v === true || v === "true";

/**
 * Regra: cada módulo do plano deve estar true; a empresa pode desativar com false explícito em modulePermissions.
 * useFlowbuilders exige plano com useCampaigns (fluxos fazem parte do ecossistema de campanhas).
 * useGroups não existe no plano: default liberado; false em modulePermissions bloqueia.
 * useInternalChat: coluna no plano + override opcional em modulePermissions (mesmo padrão dos outros gated).
 */
const GetEffectiveModuleFlags = (
  plan: Plan | null | undefined,
  modulePermissions: ModulePermissionsMap
): EffectiveModuleFlags => {
  const m = modulePermissions || {};
  const p = (plan as unknown) as Record<string, unknown> | null | undefined;

  const planOn = (key: string) => asBool(p?.[key]);

  const gated = (planKey: string, permKey: string) =>
    planOn(planKey) && m[permKey] !== false;

  const flowOk = planOn("useCampaigns") && m.useFlowbuilders !== false;

  return {
    useKanban: gated("useKanban", "useKanban"),
    useCampaigns: gated("useCampaigns", "useCampaigns"),
    useFlowbuilders: flowOk,
    useOpenAi: gated("useOpenAi", "useOpenAi"),
    useSchedules: gated("useSchedules", "useSchedules"),
    useExternalApi: gated("useExternalApi", "useExternalApi"),
    useIntegrations: gated("useIntegrations", "useIntegrations"),
    useGroups: m.useGroups !== false,
    useInternalChat: gated("useInternalChat", "useInternalChat")
  };
};

export default GetEffectiveModuleFlags;
