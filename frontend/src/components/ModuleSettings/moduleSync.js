/**
 * Módulos da empresa (JSON modulePermissions) alinhados aos flags do Plano onde existirem.
 * Regras espelhadas com backend GetEffectiveModuleFlags (gating + overrides).
 */

export const MODULE_TOGGLE_KEYS = [
  "useKanban",
  "useCampaigns",
  "useFlowbuilders",
  "useOpenAi",
  "useSchedules",
  "useExternalApi",
  "useIntegrations",
  "useGroups",
];

/** Chaves do plano que têm homónimo em modulePermissions da empresa. */
export const PLAN_KEYS_SHARED_WITH_COMPANY = [
  "useKanban",
  "useCampaigns",
  "useSchedules",
  "useExternalApi",
  "useOpenAi",
  "useIntegrations",
];

/** Ordem dos toggles no formulário de plano (inclui chat interno — só existe no plano). */
export const PLAN_FORM_MODULE_KEYS = [
  "useKanban",
  "useCampaigns",
  "useSchedules",
  "useExternalApi",
  "useOpenAi",
  "useIntegrations",
  "useInternalChat",
];

function asBool(v) {
  return v === true || v === "true";
}

/** Igual ao planOn do backend (Plan como objeto). */
export function planModuleEnabled(plan, planKey) {
  if (!plan || typeof plan !== "object") return false;
  return asBool(plan[planKey]);
}

/**
 * O plano impede uso efetivo deste módulo (independente do JSON da empresa).
 * Espelha GetEffectiveModuleFlags: grupos não são cortados pelo plano; fluxos dependem de campanhas.
 */
export function planBlocksCompanyModule(moduleKey, plan) {
  if (!plan || typeof plan !== "object") return false;
  if (moduleKey === "useGroups") return false;
  if (moduleKey === "useFlowbuilders") {
    return !planModuleEnabled(plan, "useCampaigns");
  }
  if (PLAN_KEYS_SHARED_WITH_COMPANY.includes(moduleKey)) {
    return !planModuleEnabled(plan, moduleKey);
  }
  return false;
}

/**
 * Valor efetivo do módulo (o que o backend aplicaria), para UI alinhada.
 * @param {string} moduleKey
 * @param {Record<string, boolean>} fullPermissions objeto modulePermissions completo do formulário
 */
export function getCompanyModuleEffectiveEnabled(moduleKey, fullPermissions, plan) {
  const m = mergeModulePermissions(fullPermissions);
  if (moduleKey === "useGroups") {
    return m.useGroups !== false;
  }
  if (moduleKey === "useFlowbuilders") {
    return planModuleEnabled(plan, "useCampaigns") && m.useFlowbuilders !== false;
  }
  if (!plan) {
    return false;
  }
  if (PLAN_KEYS_SHARED_WITH_COMPANY.includes(moduleKey)) {
    return (
      planModuleEnabled(plan, moduleKey) && m[moduleKey] !== false
    );
  }
  return false;
}

export function defaultModulePermissions() {
  return {
    useKanban: true,
    useCampaigns: true,
    useFlowbuilders: true,
    useOpenAi: true,
    useSchedules: true,
    useExternalApi: true,
    useIntegrations: true,
    useGroups: true,
  };
}

export function mergeModulePermissions(raw) {
  return {
    ...defaultModulePermissions(),
    ...(raw && typeof raw === "object" ? raw : {}),
  };
}

/**
 * Ao escolher "Aplicar módulos do plano": aplica booleans do plano aos módulos espelhados;
 * mantém useFlowbuilders e useGroups como estavam (não existem no plano como colunas dedicadas).
 */
export function mergeModulePermissionsFromPlan(plan, prevModules) {
  const base = mergeModulePermissions(prevModules);
  if (!plan || typeof plan !== "object") return base;
  const next = { ...base };
  PLAN_KEYS_SHARED_WITH_COMPANY.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(plan, k)) {
      next[k] = plan[k] !== false;
    }
  });
  return next;
}

/**
 * Labels de origem para a empresa (coerentes com efeito real).
 * @returns {'inherited'|'disabledOverride'|'blockedByPlan'|'companyOnly'|'noPlan'}
 */
export function getCompanyModuleOriginKey(moduleKey, fullPermissions, plan) {
  const m = mergeModulePermissions(fullPermissions);
  const stored = m[moduleKey];
  if (!plan || plan.id == null) {
    if (moduleKey === "useGroups") return "companyOnly";
    return "noPlan";
  }
  if (planBlocksCompanyModule(moduleKey, plan)) {
    return "blockedByPlan";
  }
  if (moduleKey === "useGroups") {
    return "companyOnly";
  }
  if (stored === false) return "disabledOverride";
  return "inherited";
}

/** @deprecated usar getCompanyModuleOriginKey */
export function getModuleOriginKey(moduleKey, fullPermissions, plan) {
  return getCompanyModuleOriginKey(moduleKey, fullPermissions, plan);
}

/**
 * Diff de módulos entre dois estados de plano (para resumo ao gravar).
 * @returns {{ key: string, before: boolean, after: boolean }[]}
 */
export function diffPlanModuleFlags(prevPlan, nextPlan, keys = PLAN_FORM_MODULE_KEYS) {
  const out = [];
  keys.forEach((k) => {
    const a = prevPlan && prevPlan[k] !== false;
    const b = nextPlan && nextPlan[k] !== false;
    if (a !== b) {
      out.push({ key: k, before: a, after: b });
    }
  });
  return out;
}
