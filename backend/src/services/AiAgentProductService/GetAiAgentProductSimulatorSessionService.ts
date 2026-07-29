import { Request } from "express";
import AppError from "../../errors/AppError";
import { showAiAgentSimulationSession } from "../AiAgentService/AiAgentSimulationService";
import {
  decodeSimulatorSessionRef,
  mapLegacySimulatorError,
  resolveProductSimulatorCapability
} from "./aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorSession } from "./serializeAiAgentProductSimulator";
import { AiAgentProductSimulatorSession } from "../../types/aiAgentProduct";

export default async function GetAiAgentProductSimulatorSessionService(input: {
  companyId: number;
  sessionRef: string;
  req?: Request;
}): Promise<AiAgentProductSimulatorSession> {
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

  const sessionId = decodeSimulatorSessionRef(input.sessionRef);

  try {
    const session = await showAiAgentSimulationSession({
      companyId,
      aiAgentId: cap.agentRow.id,
      sessionId
    });
    return serializeAiAgentProductSimulatorSession(
      {
        id: session.id,
        status: session.status,
        provider: session.provider,
        model: session.model,
        messageCount: session.messageCount,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        averageLatencyMs: session.averageLatencyMs,
        messages: session.messages || []
      },
      { includeMessages: true }
    );
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
