import { getAllFeatureKeys } from "../../config/features";

/** Grupos de UI (chaves = features do plano). */
export const PERMISSION_UI_GROUPS = [
  {
    id: "attendance",
    titleKey: "userPermissions.categories.attendance",
    keys: [
      "attendance.inbox",
      "attendance.kanban",
      "contacts.tags",
      "contacts.files",
      "team.groups",
      "attendance.internal_chat",
    ],
  },
  {
    id: "management",
    titleKey: "userPermissions.categories.management",
    keys: [
      "crm.pipeline",
      "agenda.calendar",
      "agenda.appointments",
      "attendance.schedules",
      "dashboard.main",
      "dashboard.reports",
    ],
  },
  {
    id: "marketing",
    titleKey: "userPermissions.categories.marketing",
    keys: [
      "campaigns.sends",
      "campaigns.lists",
      "automation.chatbot",
      "automation.quick_replies",
      "automation.integrations",
      "automation.openai",
      "automation.ai_agent",
      "automation.ai_tools",
      "automation.knowledge_base",
      "automation.keywords",
    ],
  },
  {
    id: "administration",
    titleKey: "userPermissions.categories.administration",
    keys: [
      "team.users",
      "team.queues",
      "team.ratings",
      "settings.connections",
      "settings.api",
      "finance.subscription",
      "finance.invoices",
    ],
  },
];

export const PERMISSION_PRESETS = [
  { id: "basic", labelKey: "userPermissions.presets.basic" },
  { id: "attendant", labelKey: "userPermissions.presets.attendant" },
  { id: "supervisor", labelKey: "userPermissions.presets.supervisor" },
  { id: "custom", labelKey: "userPermissions.presets.custom" },
];

const PRESET_TRUE_KEYS = {
  basic: ["dashboard.main", "attendance.internal_chat"],
  attendant: [
    "dashboard.main",
    "attendance.inbox",
    "contacts.tags",
    "contacts.files",
    "attendance.internal_chat",
    "team.groups",
  ],
  supervisor: [
    "dashboard.main",
    "dashboard.reports",
    "attendance.inbox",
    "attendance.kanban",
    "contacts.tags",
    "contacts.files",
    "attendance.internal_chat",
    "team.groups",
    "crm.pipeline",
    "agenda.calendar",
    "team.users",
    "team.queues",
  ],
};

function emptyStateForPlan(planMap) {
  const o = {};
  getAllFeatureKeys().forEach((k) => {
    if (planMap[k] === true) o[k] = false;
  });
  return o;
}

/** Aplica preset (exceto `custom`, que devolve estado só com falsos no plano — o chamador ignora). */
export function applyPermissionPreset(planMap, presetId) {
  const base = emptyStateForPlan(planMap);
  if (presetId === "custom") return base;
  const allow = PRESET_TRUE_KEYS[presetId];
  if (!allow) return base;
  Object.keys(base).forEach((k) => {
    base[k] = allow.includes(k);
  });
  return base;
}

/** Tudo o que o plano permite e o ator pode conceder (ator null = admin / sem teto). */
export function selectAllAllowedForActor(planMap, actorCeiling) {
  const o = emptyStateForPlan(planMap);
  Object.keys(o).forEach((k) => {
    if (!actorCeiling) o[k] = true;
    else o[k] = actorCeiling[k] === true;
  });
  return o;
}

export function clearAllInPlan(planMap) {
  return emptyStateForPlan(planMap);
}

/** Supervisor (ou outro ator): não pode deixar marcado o que ele próprio não tem. */
export function applyActorCeiling(state, ceiling) {
  if (!ceiling || typeof ceiling !== "object") return { ...state };
  const o = { ...state };
  Object.keys(o).forEach((k) => {
    if (o[k] === true && ceiling[k] !== true) o[k] = false;
  });
  return o;
}

export function keysForGroupInPlan(group, planMap) {
  return group.keys.filter((k) => planMap[k] === true);
}
