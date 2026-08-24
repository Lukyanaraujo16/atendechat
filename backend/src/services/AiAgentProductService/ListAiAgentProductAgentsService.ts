import type { Request } from "express";
import AiAgent from "../../models/AiAgent";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import {
  assertAiAgentProductConfigurationAccess
} from "./aiAgentProductConfigurationHelpers";
import {
  buildAiAgentProductSnapshot
} from "./GetAiAgentProductSummaryService";
import { computeAiAgentProductReadiness } from "./AgentReadinessService";
import { encodeAgentRef } from "./aiAgentProductAgentRef";

export type AiAgentProductAgentListItem = {
  agentRef: string;
  name: string;
  enabled: boolean;
  provider: string | null;
  model: string | null;
  operationMode: "off" | "shadow" | "live" | "paused";
  status: string;
  ready: boolean;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lista todos os agentes comerciais da empresa (Fase 2.9A).
 * Não trata N>1 como ambiguous.
 *
 * Performance: um snapshot completo + readiness filtrada por agente
 * (sem N consultas extras de readiness/credencial secreta).
 */
export default async function ListAiAgentProductAgentsService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<{ agents: AiAgentProductAgentListItem[] }> {
  const companyId = Number(input.companyId);
  await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const agents = await AiAgent.findAll({
    where: { companyId, archivedAt: null },
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  if (agents.length === 0) {
    return { agents: [] };
  }

  const [whatsapps, credentials, fullSnapshot] = await Promise.all([
    Whatsapp.findAll({
      where: { companyId },
      attributes: ["id", "aiAgentId"]
    }),
    AiProviderCredential.findAll({
      where: { companyId },
      attributes: ["id", "provider"]
    }),
    buildAiAgentProductSnapshot({
      companyId,
      req: input.req,
      availability: input.availability
    })
  ]);

  const credById = new Map(credentials.map(c => [c.id, c]));
  const linkCountByAgent = new Map<number, number>();
  for (const w of whatsapps) {
    if (w.aiAgentId == null) continue;
    linkCountByAgent.set(
      w.aiAgentId,
      (linkCountByAgent.get(w.aiAgentId) || 0) + 1
    );
  }

  const items: AiAgentProductAgentListItem[] = [];

  for (const agent of agents) {
    const cred =
      agent.aiProviderCredentialId != null
        ? credById.get(agent.aiProviderCredentialId) || null
        : null;
    const scopedSnapshot = {
      ...fullSnapshot,
      agents: fullSnapshot.agents.filter(a => a.id === agent.id)
    };
    const { readiness } = computeAiAgentProductReadiness(scopedSnapshot);

    items.push({
      agentRef: encodeAgentRef(agent.id),
      name: agent.name,
      enabled: agent.enabled === true,
      provider: cred ? String(cred.provider || "") : null,
      model: agent.model ? String(agent.model) : null,
      operationMode: readiness.mode,
      status: readiness.status,
      ready: readiness.ready === true,
      connectionCount: linkCountByAgent.get(agent.id) || 0,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    });
  }

  return { agents: items };
}
