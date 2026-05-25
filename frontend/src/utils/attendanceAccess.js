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

/** Alias alinhado ao pedido de produto (permissions.internalChat). */
export function hasInternalChatAccess(effectiveFeatures) {
  const fx = effectiveFeatures || {};
  return fx[INTERNAL_CHAT_FEATURE_KEY] === true;
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
  if (hasInternalChatAccess(effectiveFeatures)) {
    return "/chats";
  }
  return "/notifications";
}
