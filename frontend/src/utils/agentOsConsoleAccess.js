import { AGENTOS_CONSOLE_VIEW_PERMISSION } from "../config/agentOsConsoleRoutes";

/**
 * Early-check a partir da sessão serializada (menu / loading).
 * Não autoriza render técnico sozinho — o probe backend é obrigatório.
 */
export function hasSerializedAgentOsConsoleAccess(user) {
  if (!user || user.isInternalUser !== true) return false;
  const perms = Array.isArray(user.platformPermissions)
    ? user.platformPermissions
    : [];
  return perms.includes(AGENTOS_CONSOLE_VIEW_PERMISSION);
}

export function canShowTechnicalConsoleNav(user) {
  return hasSerializedAgentOsConsoleAccess(user);
}

export { AGENTOS_CONSOLE_VIEW_PERMISSION };
