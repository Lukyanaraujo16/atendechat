import { canManageContactLabels } from "./canManageContactLabels";

/**
 * Permissões operacionais do módulo Atendimento (WhatsApp/tickets).
 * Chat interno (`attendance.internal_chat`) não entra aqui.
 */
export const ATTENDANCE_OPERATIONAL_FEATURE_KEYS = [
  "attendance.inbox",
  "attendance.kanban",
  "contacts.tags",
  "contacts.files",
  "team.groups",
];

export const INTERNAL_CHAT_FEATURE_KEY = "attendance.internal_chat";

export function hasAttendanceModuleAccess(effectiveFeatures) {
  const fx = effectiveFeatures || {};
  return ATTENDANCE_OPERATIONAL_FEATURE_KEYS.some((key) => fx[key] === true);
}

/**
 * Chat interno: independente de attendance.inbox.
 * Usa effectiveFeatures do plano (usePlanFlags) e, se necessário, effectiveUserFeatures do JWT.
 */
export function hasInternalChatAccess(effectiveFeatures, user) {
  const fromFlags = effectiveFeatures || {};
  if (fromFlags[INTERNAL_CHAT_FEATURE_KEY] === true) {
    return true;
  }
  const fromUser = user?.effectiveUserFeatures;
  if (fromUser?.[INTERNAL_CHAT_FEATURE_KEY] === true) {
    return true;
  }
  return false;
}

/** Plano da empresa inclui chat interno (antes de permissões individuais). */
export function isInternalChatEnabledOnPlan(planFlags) {
  const pf = planFlags?.planTierEffectiveFeatures;
  if (!pf || typeof pf !== "object" || Object.keys(pf).length === 0) {
    return true;
  }
  return pf[INTERNAL_CHAT_FEATURE_KEY] === true;
}

export function canAccessInternalChatModule(effectiveFeatures, user, planFlags) {
  if (!isInternalChatEnabledOnPlan(planFlags)) {
    return false;
  }
  return hasInternalChatAccess(effectiveFeatures, user);
}

/** Home após login / modo suporte (não força /tickets). */
export function getPostLoginHomePath(user, planFlags = {}) {
  const fx =
    user?.effectiveUserFeatures && Object.keys(user.effectiveUserFeatures).length > 0
      ? user.effectiveUserFeatures
      : planFlags?.effectiveFeatures || {};
  const showDashboardNav =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  const isAdmin =
    user?.profile === "admin" ||
    user?.profile === "supervisor" ||
    user?.supportMode === true;
  return getDefaultAppPath({
    effectiveFeatures: fx,
    showDashboardNav,
    planFlags,
    isAdmin,
    user,
  });
}

export function hasAttendanceInboxAccess(effectiveFeatures) {
  return effectiveFeatures?.["attendance.inbox"] === true;
}

/**
 * Primeira rota útil do módulo Atendimento conforme permissões do utilizador.
 */
export function getAttendanceDefaultPath({
  effectiveFeatures,
  planFlags = {},
  isAdmin = false,
  user = null,
}) {
  const fx = effectiveFeatures || {};

  if (fx["attendance.inbox"] === true) {
    return "/tickets";
  }
  if (planFlags.useKanban && fx["attendance.kanban"] === true) {
    return "/kanban";
  }
  if (fx["contacts.tags"] === true && canManageContactLabels(user)) {
    return "/contacts/labels";
  }
  if (isAdmin && planFlags.useGroups && fx["team.groups"] === true) {
    return "/group-manager";
  }
  if (fx["contacts.files"] === true) {
    return "/files";
  }

  return "/tickets";
}

export function buildAtendimentoTabs({
  effectiveFeatures,
  planFlags = {},
  isAdmin = false,
  user = null,
  t,
}) {
  const fx = effectiveFeatures || {};
  const tabs = [];

  if (fx["attendance.inbox"] === true) {
    tabs.push({
      path: "/tickets",
      label: t("mainDrawer.listItems.tickets"),
    });
    tabs.push({
      path: "/contacts",
      label: t("mainDrawer.listItems.contacts"),
    });
  }

  if (planFlags.useKanban && fx["attendance.kanban"] === true) {
    tabs.push({
      path: "/kanban",
      label: t("mainDrawer.listItems.kanban"),
    });
  }

  if (fx["contacts.tags"] === true && canManageContactLabels(user)) {
    tabs.push({
      path: "/contacts/labels",
      label: t("mainDrawer.listItems.contactLabels"),
    });
  }

  if (isAdmin && planFlags.useGroups && fx["team.groups"] === true) {
    tabs.push({
      path: "/group-manager",
      label: t("mainDrawer.listItems.groups"),
    });
  }

  return tabs;
}

/**
 * Home após login ou quando um módulo bloqueia redirect genérico para /tickets.
 */
export function getDefaultAppPath({
  effectiveFeatures,
  showDashboardNav = false,
  planFlags = {},
  isAdmin = false,
  user = null,
}) {
  if (showDashboardNav) {
    return "/";
  }
  if (hasAttendanceModuleAccess(effectiveFeatures)) {
    return getAttendanceDefaultPath({
      effectiveFeatures,
      planFlags,
      isAdmin,
      user,
    });
  }
  if (canAccessInternalChatModule(effectiveFeatures, user, planFlags)) {
    return "/chats";
  }
  return "/notifications";
}
