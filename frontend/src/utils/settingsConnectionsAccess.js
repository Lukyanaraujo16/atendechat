/**
 * Acesso ao gerenciamento de Conexões WhatsApp e ao agrupamento Configurações.
 * Chave oficial do catálogo: settings.connections
 *
 * Escopo de settings.connections (contrato do sistema): gerenciamento completo —
 * listar na tela, criar, editar, excluir, QR Code, iniciar/reiniciar sessão,
 * desconectar e gerar token. Não há chave separada para ações destrutivas.
 */

export const SETTINGS_CONNECTIONS_FEATURE_KEY = "settings.connections";
export const SETTINGS_API_FEATURE_KEY = "settings.api";

function isAdminBypass(user) {
  return (
    user?.super === true ||
    user?.profile === "admin" ||
    user?.profile === "superadmin" ||
    user?.supportMode === true
  );
}

function isTenantPrivileged(user) {
  return isAdminBypass(user) || user?.profile === "supervisor";
}

function featureEnabled(planFlags, user, featureKey) {
  const fx = planFlags?.effectiveFeatures || {};
  if (fx[featureKey] === true) return true;
  if (!planFlags?.loaded) {
    return user?.effectiveUserFeatures?.[featureKey] === true;
  }
  return false;
}

/**
 * Gerenciamento completo de conexões/sessões WhatsApp.
 * Respeita plano ∧ permissão granular (admin já vem com bypass no mapa efetivo).
 */
export function canManageWhatsAppConnections(planFlags, user) {
  return featureEnabled(planFlags, user, SETTINGS_CONNECTIONS_FEATURE_KEY);
}

export function canAccessMessagesApiSettings(planFlags, user) {
  if (planFlags?.useExternalApi === true) return true;
  return featureEnabled(planFlags, user, SETTINGS_API_FEATURE_KEY);
}

/** Página /settings (definições da empresa) — sem chave granular; admin/supervisor. */
export function canAccessCompanySettingsPage(user) {
  return isTenantPrivileged(user);
}

export function canAccessMediaManagerSettings(user) {
  return isAdminBypass(user);
}

export function canAccessGroupsManagerSettings(planFlags, user) {
  return isTenantPrivileged(user) && planFlags?.useGroups !== false;
}

/**
 * Visibilidade do menu pai Configurações e abas internas.
 * O pai aparece se houver pelo menos um item autorizado.
 */
export function getConfiguracoesAccess(planFlags, user) {
  const showConnections = canManageWhatsAppConnections(planFlags, user);
  const showApi = canAccessMessagesApiSettings(planFlags, user);
  const showCompanySettings = canAccessCompanySettingsPage(user);
  const showMediaManager = canAccessMediaManagerSettings(user);
  const showGroups = canAccessGroupsManagerSettings(planFlags, user);

  const paths = [];
  if (showConnections) paths.push("/connections");
  if (showApi) paths.push("/messages-api");
  if (showCompanySettings) paths.push("/settings");
  if (showMediaManager) paths.push("/settings/media-manager");
  if (showGroups) paths.push("/settings/groups");

  return {
    visible: paths.length > 0,
    defaultPath: paths[0] || "/connections",
    showConnections,
    showApi,
    showCompanySettings,
    showMediaManager,
    showGroups,
  };
}
