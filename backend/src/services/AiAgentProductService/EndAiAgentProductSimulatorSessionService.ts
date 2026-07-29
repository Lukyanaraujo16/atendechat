import { Request } from "express";
import { endAiAgentSimulationSession } from "../AiAgentService/AiAgentSimulationService";
import {
  assertProductSimulatorCanMutate,
  decodeSimulatorSessionRef,
  encodeSimulatorSessionRef,
  mapLegacySimulatorError
} from "./aiAgentProductSimulatorHelpers";

export default async function EndAiAgentProductSimulatorSessionService(input: {
  companyId: number;
  sessionRef: string;
  req?: Request;
}): Promise<{
  ref: string;
  status: string;
  endedAt: string | null;
}> {
  const companyId = Number(input.companyId);
  const cap = await assertProductSimulatorCanMutate(companyId, input.req);
  const sessionId = decodeSimulatorSessionRef(input.sessionRef);

  try {
    const result = await endAiAgentSimulationSession({
      companyId,
      aiAgentId: cap.agentRow.id,
      sessionId
    });
    const endedAt =
      result.endedAt instanceof Date
        ? result.endedAt.toISOString()
        : result.endedAt
          ? new Date(String(result.endedAt)).toISOString()
          : null;
    return {
      ref: encodeSimulatorSessionRef(result.id),
      status: String(result.status || "ended"),
      endedAt
    };
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
