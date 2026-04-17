import Plan from "../../models/Plan";

/** Chaves do plano que espelham `modulePermissions` nas empresas (exc. useFlowbuilders — não existe no plano). */
export const PLAN_PROPAGATION_MODULE_KEYS = [
  "useKanban",
  "useCampaigns",
  "useSchedules",
  "useInternalChat",
  "useExternalApi",
  "useOpenAi",
  "useIntegrations"
] as const;

export type PlanPropagationMode = "none" | "respect_overrides" | "force_all";

export const normalizePlanBool = (v: unknown): boolean =>
  v === true || v === "true";

/**
 * Chaves de módulo presentes no body cujo valor efetivo difere do plano atual na BD.
 */
export const getChangedPropagationKeys = (
  planBefore: Plan,
  incoming: Record<string, unknown>
): Record<string, boolean> => {
  return PLAN_PROPAGATION_MODULE_KEYS.reduce((acc, key) => {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) {
      return acc;
    }
    const before = normalizePlanBool(
      planBefore.getDataValue(key as keyof Plan)
    );
    const after = normalizePlanBool(incoming[key]);
    if (before !== after) {
      acc[key] = after;
    }
    return acc;
  }, {} as Record<string, boolean>);
};

const hasExplicitModuleKey = (
  perms: Record<string, boolean> | null | undefined,
  key: string
): boolean =>
  typeof perms === "object" &&
  perms !== null &&
  Object.prototype.hasOwnProperty.call(perms, key);

/**
 * Aplica valores do plano nas chaves alteradas, preservando o restante JSON da empresa.
 */
export const mergeCompanyPermissionsForPropagation = (
  existing: Record<string, boolean> | null | undefined,
  changedPlanKeys: Record<string, boolean>,
  mode: "respect_overrides" | "force_all"
): Record<string, boolean> => {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  Object.keys(changedPlanKeys).forEach(key => {
    const value = changedPlanKeys[key];
    if (mode === "force_all") {
      base[key] = value;
    } else if (!hasExplicitModuleKey(existing, key)) {
      base[key] = value;
    }
  });
  return base;
};

export const normalizePropagationMode = (v: unknown): PlanPropagationMode => {
  if (v === "respect_overrides" || v === "force_all") return v;
  return "none";
};
