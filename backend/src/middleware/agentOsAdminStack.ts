import { RequestHandler } from "express";
import isAuth from "./isAuth";
import requireEffectiveModule from "./requireEffectiveModule";
import requireTenantAdminOrSupport from "./requireTenantAdminOrSupport";
import { agentOsAutoRateLimit } from "./agentOsRateLimit";
import agentOsPayloadGuard from "./agentOsPayloadGuard";
import requireAgentOsConfirmation from "./requireAgentOsConfirmation";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../config/automationToolConstants";
import { AGENTOS_FEATURE_KEYS } from "../config/automationAgentOsSecurityConstants";

/**
 * Stack padrão AgentOS Wave 2: auth → plano → rate → payload → admin → confirmação.
 */
export function agentOsAdminStack(
  moduleFeatures: string[] = [
    AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
    AUTOMATION_AI_TOOLS_FEATURE_KEY
  ]
): RequestHandler[] {
  return [
    isAuth,
    ...moduleFeatures.map(f => requireEffectiveModule(f)),
    agentOsAutoRateLimit,
    agentOsPayloadGuard,
    requireTenantAdminOrSupport,
    requireAgentOsConfirmation
  ];
}

export const agentOsStacks = {
  core: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY
    ]),
  memory: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.memory
    ]),
  learning: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.learning
    ]),
  mcp: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.mcp
    ]),
  multiAgent: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.multiAgent
    ]),
  runtime: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.runtime
    ]),
  replay: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.replay
    ]),
  monitor: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.monitor
    ]),
  dashboard: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.dashboard
    ]),
  tester: () =>
    agentOsAdminStack([
      AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
      AUTOMATION_AI_TOOLS_FEATURE_KEY,
      AGENTOS_FEATURE_KEYS.tester
    ])
};
