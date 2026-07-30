import { Request } from "express";
import { sendAiAgentSimulationMessage } from "../AiAgentService/AiAgentSimulationService";
import {
  assertProductSimulatorCanMutate,
  decodeSimulatorSessionRef,
  mapLegacySimulatorError
} from "./aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorSendResult } from "./serializeAiAgentProductSimulator";

export default async function SendAiAgentProductSimulatorMessageService(input: {
  companyId: number;
  sessionRef: string;
  content: unknown;
  userId?: number | null;
  req?: Request;
  agentRef?: unknown;
}) {
  const companyId = Number(input.companyId);
  const cap = await assertProductSimulatorCanMutate(
    companyId,
    input.req,
    input.agentRef
  );
  const sessionId = decodeSimulatorSessionRef(input.sessionRef);

  try {
    const result = await sendAiAgentSimulationMessage({
      companyId,
      aiAgentId: cap.agentRow.id,
      sessionId,
      content: input.content,
      userId: input.userId ?? null
      // Product API: never pass functionCalling
    });

    return serializeAiAgentProductSimulatorSendResult({
      userMessage: {
        id: result.userMessage.id,
        role: result.userMessage.role,
        content: result.userMessage.content,
        createdAt: result.userMessage.createdAt,
        handoffSuggested: false
      },
      assistantMessage: {
        id: result.assistantMessage.id,
        role: result.assistantMessage.role,
        content: result.assistantMessage.content,
        createdAt: result.assistantMessage.createdAt,
        latencyMs: result.assistantMessage.latencyMs,
        handoffSuggested: result.assistantMessage.handoffSuggested === true
      },
      session: {
        id: result.session.id,
        messageCount: result.session.messageCount,
        status: "active"
      }
    });
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
