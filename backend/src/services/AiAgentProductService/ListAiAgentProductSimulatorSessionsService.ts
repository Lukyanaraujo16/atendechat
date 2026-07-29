import { Request } from "express";
import AppError from "../../errors/AppError";
import { listAiAgentSimulationSessions } from "../AiAgentService/AiAgentSimulationService";
import {
  mapLegacySimulatorError,
  resolveProductSimulatorCapability
} from "./aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorSession } from "./serializeAiAgentProductSimulator";
import { AiAgentProductSimulatorSession } from "../../types/aiAgentProduct";

export default async function ListAiAgentProductSimulatorSessionsService(input: {
  companyId: number;
  req?: Request;
  pageNumber?: string;
}): Promise<{
  sessions: AiAgentProductSimulatorSession[];
  count: number;
  hasMore: boolean;
}> {
  const companyId = Number(input.companyId);
  const cap = await resolveProductSimulatorCapability(companyId, input.req);

  if (cap.resolution === "ambiguous") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
      409,
      "Existem várias configurações de Agente de IA. Revise antes de continuar."
    );
  }
  if (cap.resolution !== "resolved" || !cap.agentRow) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE",
      400,
      "O simulador do Agente de IA não está disponível.",
      { reason: "not_created" }
    );
  }

  try {
    const listed = await listAiAgentSimulationSessions({
      companyId,
      aiAgentId: cap.agentRow.id,
      pageNumber: input.pageNumber
    });
    return {
      sessions: (listed.sessions || []).map(s =>
        serializeAiAgentProductSimulatorSession({
          id: s.id,
          status: s.status,
          provider: s.provider,
          model: s.model,
          messageCount: s.messageCount,
          startedAt: s.startedAt,
          endedAt: s.endedAt
        })
      ),
      count: listed.count,
      hasMore: listed.hasMore
    };
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
