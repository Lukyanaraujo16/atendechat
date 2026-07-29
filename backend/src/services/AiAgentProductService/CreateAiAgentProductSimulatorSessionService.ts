import { Request } from "express";
import { createAiAgentSimulationSession } from "../AiAgentService/AiAgentSimulationService";
import {
  assertProductSimulatorCanMutate,
  mapLegacySimulatorError
} from "./aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorSession } from "./serializeAiAgentProductSimulator";
import { AiAgentProductSimulatorSession } from "../../types/aiAgentProduct";

export default async function CreateAiAgentProductSimulatorSessionService(input: {
  companyId: number;
  userId: number;
  req?: Request;
}): Promise<AiAgentProductSimulatorSession> {
  const companyId = Number(input.companyId);
  const cap = await assertProductSimulatorCanMutate(companyId, input.req);

  try {
    const session = await createAiAgentSimulationSession({
      companyId,
      aiAgentId: cap.agentRow.id,
      createdBy: input.userId
    });
    return serializeAiAgentProductSimulatorSession(
      {
        id: session.id,
        status: session.status,
        provider: session.provider,
        model: session.model,
        messageCount: session.messageCount,
        startedAt: session.startedAt,
        messages: []
      },
      { includeMessages: true }
    );
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
