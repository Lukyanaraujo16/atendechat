/**
 * Módulos da empresa (`modulePermissions`) alinhados ao plano granular (PlanFeatures)
 * e às colunas legadas do Plan quando `planFeatures` não vem na API.
 * Espelha a resolução do backend: `resolvePlanFeature` + gates em chaves legadas.
 */

import { getAllFeatureKeys } from "../../config/features";
import { mergeInventoryGranularFeatures } from "../../config/inventorySalesPermissions";

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

/**
 * Features de plano necessárias para cada toggle legado (OR: basta uma activa).
 * Alinhado a `buildEffectiveModuleFlagsFromFeatureMap` / rotas com `requirePlanFeature`.
 */
export const MODULE_PLAN_FEATURE_KEYS = {
  useKanban: ["attendance.kanban"],
  useCampaigns: ["campaigns.sends", "campaigns.lists"],
  useFlowbuilders: ["automation.chatbot"],
  useOpenAi: ["automation.openai"],
  /** Inclui envios agendados no catálogo (agenda.appointments + attendance.schedules). Calendário (agenda.calendar) só no plano. */
  useSchedules: ["agenda.appointments", "attendance.schedules"],
  useExternalApi: ["settings.api"],
  useIntegrations: ["automation.integrations"],
  useGroups: ["team.groups"],
};

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

/**
 * Valor legado por coluna do Plan (quando não há `plan.planFeatures` no cliente).
 * Mantido em sincronia com `backend/src/config/planFeatureLegacy.ts`.
 */
export function legacyPlanFeatureValueFromColumns(plan, featureKey) {
  if (!plan) return false;
  switch (featureKey) {
    case "dashboard.main":
    case "dashboard.reports":
    case "attendance.inbox":
    case "contacts.tags":
    case "contacts.files":
    case "settings.connections":
    case "agenda.calendar":
    case "team.users":
    case "team.queues":
    case "team.ratings":
    case "team.groups":
    case "finance.subscription":
    case "finance.invoices":
      return true;
    case "crm.pipeline":
    case "settings.instagram_integration":
    case "inventory.sales":
    case "inventory.sales.view":
    case "inventory.sales.manageProducts":
    case "inventory.sales.manageStock":
    case "inventory.sales.createSale":
    case "inventory.sales.cancelSale":
    case "inventory.sales.managePayments":
    case "inventory.sales.viewReports":
    case "inventory.sales.manageSettings":
    case "automation.ai_agent":
      return false;
    case "attendance.kanban":
      return asBool(plan.useKanban);
    case "attendance.internal_chat":
      return asBool(plan.useInternalChat);
    case "automation.openai":
      return asBool(plan.useOpenAi);
    case "automation.integrations":
      return asBool(plan.useIntegrations);
    case "agenda.appointments":
    case "attendance.schedules":
      return asBool(plan.useSchedules);
    case "settings.api":
      return asBool(plan.useExternalApi);
    case "campaigns.sends":
    case "campaigns.lists":
    case "automation.chatbot":
    case "automation.keywords":
    case "automation.quick_replies":
      return asBool(plan.useCampaigns);
    default:
      return true;
  }
}

/** Mapa completo de features ao nível do plano (sem overrides da empresa). */
export function getPlanLevelFeatureMap(plan) {
  if (!plan || typeof plan !== "object") return {};
  if (plan.planFeatures && typeof plan.planFeatures === "object") {
    return { ...plan.planFeatures };
  }
  const keys = getAllFeatureKeys();
  const out = {};
  for (const k of keys) {
    out[k] = legacyPlanFeatureValueFromColumns(plan, k);
  }
  return out;
}

/** O plano inclui pelo menos uma das features necessárias para este módulo legado? */
export function planAllowsCompanyModule(moduleKey, plan) {
  const reqs = MODULE_PLAN_FEATURE_KEYS[moduleKey];
  if (!reqs || !plan || plan.id == null) return false;
  const map = getPlanLevelFeatureMap(plan);
  return reqs.some((fk) => map[fk] === true);
}

/** @deprecated Preferir `planAllowsCompanyModule`; mantido para código que ainda lê colunas isoladas. */
export function planModuleEnabled(plan, planKey) {
  if (!plan || typeof plan !== "object") return false;
  return asBool(plan[planKey]);
}

/**
 * O plano impede uso efetivo deste módulo (independente do JSON da empresa).
 */
export function planBlocksCompanyModule(moduleKey, plan) {
  if (!plan || plan.id == null) return false;
  return !planAllowsCompanyModule(moduleKey, plan);
}

/**
 * Valor efetivo do módulo (o que o backend aplicaria após `resolvePlanFeature` + overrides legados).
 */
export function getCompanyModuleEffectiveEnabled(moduleKey, fullPermissions, plan) {
  const m = mergeModulePermissions(fullPermissions);
  if (!plan || plan.id == null) {
    if (moduleKey === "useGroups") return m.useGroups !== false;
    return false;
  }
  if (!planAllowsCompanyModule(moduleKey, plan)) {
    return false;
  }
  if (moduleKey === "useGroups") {
    return m.useGroups !== false;
  }
  if (moduleKey === "useFlowbuilders") {
    return m.useFlowbuilders !== false;
  }
  if (PLAN_KEYS_SHARED_WITH_COMPANY.includes(moduleKey)) {
    return m[moduleKey] !== false;
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

/** Espelha `buildEffectiveModuleFlagsFromFeatureMap` no backend. */
/**
 * Combina features do plano (API em tempo real) com o mapa do utilizador (JWT).
 * Admin/super herda o plano atual; utilizadores com mapa explícito respeitam negações,
 * mas chaves novas no plano (ex.: inventory.sales) herdam o plano até permissão explícita.
 */
export function mergeLiveEffectiveFeatures(planFeatures, user) {
  const planFx =
    planFeatures && typeof planFeatures === "object" ? planFeatures : {};
  const userFx = user?.effectiveUserFeatures;
  const bypass =
    user?.super === true ||
    user?.profile === "admin" ||
    user?.profile === "superadmin";

  if (
    bypass ||
    !userFx ||
    typeof userFx !== "object" ||
    Object.keys(userFx).length === 0
  ) {
    return {
      ...planFx,
      ...mergeInventoryGranularFeatures(planFx, userFx, user),
    };
  }

  const keys = new Set([...Object.keys(planFx), ...Object.keys(userFx)]);
  const out = {};
  keys.forEach((k) => {
    if (planFx[k] !== true) {
      out[k] = false;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(userFx, k)) {
      out[k] = userFx[k] === true;
    } else {
      out[k] = true;
    }
  });
  return {
    ...out,
    ...mergeInventoryGranularFeatures(planFx, userFx, user),
  };
}

export function buildEffectiveModuleFlagsFromFeatureMap(featureMap, modulePermissions) {
  const m = mergeModulePermissions(modulePermissions);
  const fx = featureMap && typeof featureMap === "object" ? featureMap : {};
  return {
    useKanban: fx["attendance.kanban"] === true,
    useCampaigns:
      fx["campaigns.sends"] === true || fx["campaigns.lists"] === true,
    useFlowbuilders:
      fx["automation.chatbot"] === true && m.useFlowbuilders !== false,
    useOpenAi: fx["automation.openai"] === true,
    useSchedules:
      fx["agenda.appointments"] === true || fx["attendance.schedules"] === true,
    useExternalApi: fx["settings.api"] === true,
    useIntegrations: fx["automation.integrations"] === true,
    useGroups: fx["team.groups"] === true && m.useGroups !== false,
    useInternalChat: fx["attendance.internal_chat"] === true,
  };
}

/**
 * Ao escolher "Aplicar módulos do plano": alinha toggles espelhados ao que o plano permite
 * (via features granulares ou colunas legadas). Não altera useFlowbuilders nem useGroups
 * (continua o comportamento anterior: só chaves em PLAN_KEYS_SHARED_WITH_COMPANY).
 */
export function mergeModulePermissionsFromPlan(plan, prevModules) {
  const base = mergeModulePermissions(prevModules);
  if (!plan || typeof plan !== "object") return base;
  const next = { ...base };
  PLAN_KEYS_SHARED_WITH_COMPANY.forEach((k) => {
    next[k] = planAllowsCompanyModule(k, plan);
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
    if (stored === false) return "disabledOverride";
    return "inherited";
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
