import { RequestHandler } from "express";
import isAuth from "./isAuth";
import requireEffectiveModule from "./requireEffectiveModule";
import { agentOsAutoRateLimit } from "./agentOsRateLimit";
import agentOsPayloadGuard from "./agentOsPayloadGuard";
import requireAgentOsConfirmation from "./requireAgentOsConfirmation";
import requireAgentOsTenantContext from "./requireAgentOsTenantContext";
import requireAgentOsMutationGate from "./requireAgentOsMutationGate";
import { requireAgentOsConsole } from "./requirePlatformPermission";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../config/automationToolConstants";
import { AGENTOS_FEATURE_KEYS } from "../config/automationAgentOsSecurityConstants";

/**
 * Stack AgentOS Console (Fase 1.4):
 * auth → plataforma (interno + console.view) → tenant context → features de plano
 * → rate → payload → mutação (chave específica) → confirmação sensível.
 *
 * Features usam req.user.companyId (empresa ativa, incl. supportMode).
 * Internos passam isPlatformSuperUser e bypassam feature de plano (capacidade
 * comercial do tenant não bloqueia o Console; documentado na matriz 1.4.1).
 *
 * NÃO usa admin tenant / supportMode como autorização de entrada.
 */
export function agentOsAdminStack(
  moduleFeatures: string[] = [
    AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
    AUTOMATION_AI_TOOLS_FEATURE_KEY
  ]
): RequestHandler[] {
  return [
    isAuth,
    requireAgentOsConsole,
    requireAgentOsTenantContext,
    ...moduleFeatures.map(f => requireEffectiveModule(f)),
    agentOsAutoRateLimit,
    agentOsPayloadGuard,
    requireAgentOsMutationGate,
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
