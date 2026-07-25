/**
 * Permissões internas da plataforma (não confundir com PlanFeatures
 * nem UserFeaturePermission de tenant).
 *
 * Architecture Lock §19–§20 — AI Agent V1.1.
 */

export const PLATFORM_PERMISSION_KEYS = {
  AGENTOS_CONSOLE_VIEW: "agentOS.console.view",
  AGENTOS_CONSOLE_MANAGE: "agentOS.console.manage",
  AGENTOS_REPLAY_EXECUTE: "agentOS.replay.execute",
  AGENTOS_ROLLOUT_MANAGE: "agentOS.rollout.manage",
  AGENTOS_INCIDENTS_MANAGE: "agentOS.incidents.manage",
  AGENTOS_SECURITY_VIEW: "agentOS.security.view",
  AGENTOS_PRODUCTION_MANAGE: "agentOS.production.manage"
} as const;

export type PlatformPermissionKey =
  (typeof PLATFORM_PERMISSION_KEYS)[keyof typeof PLATFORM_PERMISSION_KEYS];

/** Lista estável das chaves conhecidas nesta fase (extensível por string no banco). */
export const KNOWN_PLATFORM_PERMISSION_KEYS: readonly PlatformPermissionKey[] =
  Object.freeze(Object.values(PLATFORM_PERMISSION_KEYS));

export const AGENTOS_CONSOLE_VIEW_PERMISSION =
  PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_VIEW;
