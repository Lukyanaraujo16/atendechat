/**
 * Permissões de plataforma AgentOS no frontend (sessão serializada).
 * Não substituem o probe nem o backend.
 */
export const AGENTOS_PLATFORM_PERMISSION_KEYS = {
  CONSOLE_VIEW: "agentOS.console.view",
  CONSOLE_MANAGE: "agentOS.console.manage",
  REPLAY_EXECUTE: "agentOS.replay.execute",
  ROLLOUT_MANAGE: "agentOS.rollout.manage",
  INCIDENTS_MANAGE: "agentOS.incidents.manage",
  SECURITY_VIEW: "agentOS.security.view",
  PRODUCTION_MANAGE: "agentOS.production.manage",
};

export function hasPlatformPermission(user, permissionKey) {
  if (!user || !permissionKey) return false;
  const perms = Array.isArray(user.platformPermissions)
    ? user.platformPermissions
    : [];
  return perms.includes(permissionKey);
}

export function canViewAgentOsConsole(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.CONSOLE_VIEW
  );
}

export function canManageAgentOsConsole(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.CONSOLE_MANAGE
  );
}

export function canManageAgentOsRollout(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.ROLLOUT_MANAGE
  );
}

export function canManageAgentOsProduction(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.PRODUCTION_MANAGE
  );
}

export function canManageAgentOsIncidents(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.INCIDENTS_MANAGE
  );
}

export function canExecuteAgentOsReplay(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.REPLAY_EXECUTE
  );
}

export function canViewAgentOsSecurity(user) {
  return hasPlatformPermission(
    user,
    AGENTOS_PLATFORM_PERMISSION_KEYS.SECURITY_VIEW
  );
}

/**
 * Snapshot de grants para páginas do Console (somente leitura vs mutações).
 */
export function getAgentOsConsoleActionGrants(user) {
  const canView = canViewAgentOsConsole(user);
  const canManage = canManageAgentOsConsole(user);
  const canReplay = canExecuteAgentOsReplay(user);
  const canRollout = canManageAgentOsRollout(user);
  const canProduction = canManageAgentOsProduction(user);
  const canIncidents = canManageAgentOsIncidents(user);
  const canSecurity = canViewAgentOsSecurity(user);
  return {
    canView,
    canManage,
    canReplay,
    canRollout,
    canProduction,
    canIncidents,
    canSecurity,
    readOnlyManage: canView && !canManage,
    readOnlyRollout: canView && !canRollout,
    readOnlyProduction: canView && !canProduction,
  };
}
