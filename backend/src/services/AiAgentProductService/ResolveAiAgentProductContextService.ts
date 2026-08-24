import {
  AiAgentProductAgentScope
} from "../../types/aiAgentProduct";
import { AiAgentProductAgentSnapshot } from "./AgentReadinessService";

/**
 * Resolução pura a partir de uma lista de snapshots (readiness / testes).
 *
 * Operações Product agent-scoped usam `resolveAiAgentProductAgentForOperation`
 * (agentRef explícito ou compat 0/1). Este helper permanece para compute de
 * readiness quando o snapshot já está filtrado (ou em testes unitários).
 *
 * Elegíveis: AiAgent da empresa com archivedAt IS NULL (Product).
 * - enabled=false NÃO exclui o candidato.
 * - Arquivados não entram em Hub, Detail, wizard, commands nem readiness.
 * - Sem preferência por vínculo WhatsApp / createdAt.
 */
export type AiAgentProductAgentResolution =
  | "not_created"
  | "resolved"
  | "ambiguous";

export type AiAgentProductResolvedContext = {
  resolution: AiAgentProductAgentResolution;
  /** Preenchido somente quando resolution === "resolved". */
  agent: AiAgentProductAgentSnapshot | null;
  candidatesCount: number;
  agentScope: AiAgentProductAgentScope;
};

export function emptyAgentScope(): AiAgentProductAgentScope {
  return { type: "none", count: 0 };
}

/**
 * Resolver puro e determinístico a partir da lista de candidatos já filtrados por companyId.
 * Não aplica heurística enabled/name/id quando há mais de um.
 */
export function resolveAiAgentProductAgentContext(
  agents: AiAgentProductAgentSnapshot[]
): AiAgentProductResolvedContext {
  const candidates = Array.isArray(agents) ? agents : [];
  const count = candidates.length;

  if (count === 0) {
    return {
      resolution: "not_created",
      agent: null,
      candidatesCount: 0,
      agentScope: { type: "none", count: 0 }
    };
  }

  if (count === 1) {
    return {
      resolution: "resolved",
      agent: candidates[0],
      candidatesCount: 1,
      agentScope: { type: "single", count: 1 }
    };
  }

  return {
    resolution: "ambiguous",
    agent: null,
    candidatesCount: count,
    agentScope: { type: "ambiguous", count }
  };
}

/**
 * Revalidação dentro de transação: mesmos critérios, sobre rows lockadas.
 */
export function resolveAiAgentProductAgentContextFromRows<
  T extends { id: number; enabled?: boolean; name?: string }
>(rows: T[]): {
  resolution: AiAgentProductAgentResolution;
  agent: T | null;
  candidatesCount: number;
  agentScope: AiAgentProductAgentScope;
} {
  const count = rows.length;
  if (count === 0) {
    return {
      resolution: "not_created",
      agent: null,
      candidatesCount: 0,
      agentScope: { type: "none", count: 0 }
    };
  }
  if (count === 1) {
    return {
      resolution: "resolved",
      agent: rows[0],
      candidatesCount: 1,
      agentScope: { type: "single", count: 1 }
    };
  }
  return {
    resolution: "ambiguous",
    agent: null,
    candidatesCount: count,
    agentScope: { type: "ambiguous", count }
  };
}
