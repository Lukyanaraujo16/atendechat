/**
 * ResolveAiAgentProductAgentService — resolução comercial multiagente (Fase 2.9A).
 * Reexporta o contrato público de agentRef / resolução operacional.
 */
export {
  encodeAgentRef,
  parseOptionalAgentRef,
  parseRequiredAgentRef,
  findAiAgentProductByRefOrThrow,
  resolveAiAgentProductAgentForOperation,
  extractAgentRefFromRequest,
  ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED,
  ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND
} from "./aiAgentProductAgentRef";
export type { ProductAgentResolution } from "./aiAgentProductAgentRef";

import {
  AiAgentProductSnapshot
} from "./AgentReadinessService";

/**
 * Filtra snapshot para um único agente — readiness/commands sem ambiguous.
 */
export function scopeAiAgentProductSnapshotToAgent(
  snapshot: AiAgentProductSnapshot,
  agentId: number
): AiAgentProductSnapshot {
  return {
    ...snapshot,
    agents: snapshot.agents.filter(a => a.id === agentId)
  };
}
