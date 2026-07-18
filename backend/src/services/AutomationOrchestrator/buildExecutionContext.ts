import {
  AUTOMATION_DEFAULT_CONTROL_MODE,
  AutomationControlMode
} from "../../config/automationOrchestratorConstants";
import { isFlowAutomationActive } from "../AiAgentService/isFlowAutomationActive";
import { resolveWhatsappAiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import { ExecutionContext } from "./types";

export type BuildExecutionContextInboundInput = {
  companyId: number;
  channel?: string;
  messageId?: string | null;
  controlMode?: AutomationControlMode;
  ticket: {
    id: number;
    status?: string | null;
    userId?: number | null;
    chatbot?: boolean | null;
    queueId?: number | null;
    aiAgentId?: number | null;
    aiAgentPaused?: boolean | null;
    aiAgentHandoffRequested?: boolean | null;
    isGroup?: boolean | null;
    flowStopped?: string | number | null;
    flowWebhook?: boolean | null;
    lastFlowId?: number | null;
    contactId?: number | null;
    whatsappId?: number | null;
  };
  contact: {
    id: number;
    name?: string | null;
  };
  whatsapp?: {
    id?: number | null;
    aiAgentId?: number | null;
    aiAgentEnabled?: boolean | null;
    aiAgentMode?: string | null;
  } | null;
  currentMessage?: {
    body?: string | null;
    fromMe?: boolean;
    hasText?: boolean;
  };
  conversationHistory?: ExecutionContext["conversationHistory"];
  aiAgent?: ExecutionContext["aiAgent"];
  knowledge?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  integrationActive?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Monta ExecutionContext a partir de objetos plain (sem DB para knowledge).
 */
export function buildExecutionContextFromInbound(
  input: BuildExecutionContextInboundInput
): ExecutionContext {
  const ticketLike = input.ticket as unknown as Parameters<
    typeof isFlowAutomationActive
  >[0];
  const flow = isFlowAutomationActive(ticketLike);

  const chatbotActive = input.ticket.chatbot === true;
  const whatsapp = input.whatsapp || null;

  const runtimeMode = whatsapp
    ? resolveWhatsappAiAgentRuntimeMode(
        whatsapp as Parameters<typeof resolveWhatsappAiAgentRuntimeMode>[0]
      )
    : "disabled";

  const aiAgentId =
    input.aiAgent?.id ??
    input.ticket.aiAgentId ??
    whatsapp?.aiAgentId ??
    null;

  let aiAgent = input.aiAgent ?? null;
  if (!aiAgent && aiAgentId != null) {
    aiAgent = {
      id: Number(aiAgentId),
      enabled:
        whatsapp?.aiAgentEnabled === true ||
        runtimeMode === "live" ||
        runtimeMode === "shadow" ||
        runtimeMode === "dry_run"
    };
  }

  const body = String(input.currentMessage?.body ?? "");
  const hasText =
    input.currentMessage?.hasText ?? body.trim().length > 0;

  const controlMode =
    input.controlMode || AUTOMATION_DEFAULT_CONTROL_MODE;

  return {
    companyId: input.companyId,
    ticketId: input.ticket.id,
    contactId: input.contact.id ?? input.ticket.contactId ?? null,
    whatsappId: whatsapp?.id ?? input.ticket.whatsappId ?? null,
    channel: input.channel || "whatsapp",
    messageId: input.messageId ?? null,
    ticket: {
      id: input.ticket.id,
      status: String(input.ticket.status || "pending"),
      userId: input.ticket.userId ?? null,
      chatbot: chatbotActive,
      queueId: input.ticket.queueId ?? null,
      aiAgentId: input.ticket.aiAgentId ?? aiAgentId,
      aiAgentPaused: input.ticket.aiAgentPaused ?? null,
      aiAgentHandoffRequested: input.ticket.aiAgentHandoffRequested ?? null,
      isGroup: input.ticket.isGroup === true
    },
    contact: {
      id: input.contact.id,
      name: input.contact.name ?? null
    },
    currentMessage: {
      body: body.slice(0, 2000),
      fromMe: input.currentMessage?.fromMe === true,
      hasText
    },
    conversationHistory: (input.conversationHistory || []).slice(0, 20),
    aiAgent,
    knowledge: input.knowledge || {},
    variables: input.variables || {},
    flowState: {
      active: flow.active,
      reason: flow.reason
    },
    chatbotState: { active: chatbotActive },
    integrationState: {
      active: input.integrationActive === true
    },
    controlMode,
    metadata: {
      runtimeMode,
      ...(input.metadata || {})
    }
  };
}

export default buildExecutionContextFromInbound;
