import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { isFlowAutomationActive } from "../services/AiAgentService/isFlowAutomationActive";
import { resolveWhatsappAiAgentRuntimeMode } from "../services/AiAgentService/aiAgentRuntimeMode";

export type TicketAutomationType =
  | "chatbot"
  | "ai_agent"
  | "flowbuilder"
  | "typebot"
  | "n8n"
  | "openai_legacy"
  | "integration"
  | null;

export type TicketAutomationState = {
  automationActive: boolean;
  automationType: TicketAutomationType;
  automationLabel: string | null;
  aiAgentActive: boolean;
  aiAgentPaused: boolean;
  aiAgentMode: "disabled" | "dry_run" | "shadow" | "live" | null;
  aiAgentId: number | null;
  aiAgentName: string | null;
  reason?: string;
};

type ResolveInput = {
  ticket: Ticket;
  whatsapp?: Pick<
    Whatsapp,
    "aiAgentMode" | "aiAgentId" | "aiAgentEnabled"
  > | null;
  aiAgentName?: string | null;
  hasAiAgentOutboundMessage?: boolean;
  hasLiveRuntimeActivity?: boolean;
};

function resolveWhatsappMode(
  whatsapp?: Pick<Whatsapp, "aiAgentMode" | "aiAgentEnabled" | "aiAgentId"> | null
): "disabled" | "dry_run" | "shadow" | "live" | null {
  if (!whatsapp) return null;
  return resolveWhatsappAiAgentRuntimeMode(whatsapp as Whatsapp);
}

function resolveIntegrationAutomationType(ticket: Ticket): TicketAutomationType {
  if (ticket.promptId != null) {
    return "openai_legacy";
  }
  if (ticket.typebotStatus === true && ticket.typebotSessionId) {
    return "typebot";
  }
  const integrationType = String(
    (ticket as { queueIntegration?: { type?: string } }).queueIntegration?.type ||
      ""
  ).toLowerCase();
  if (integrationType === "n8n" || integrationType === "webhook") {
    return "n8n";
  }
  if (integrationType === "flowbuilder") {
    return "flowbuilder";
  }
  if (integrationType) {
    return "integration";
  }
  return null;
}

function automationLabelForType(type: TicketAutomationType): string | null {
  switch (type) {
    case "chatbot":
      return "Chatbot";
    case "ai_agent":
      return "IA atendendo";
    case "flowbuilder":
      return "Fluxo";
    case "typebot":
    case "n8n":
    case "integration":
      return "Integração";
    case "openai_legacy":
      return "OpenAI";
    default:
      return null;
  }
}

export function isTicketAiAgentAutomationCandidate(
  ticket: Pick<
    Ticket,
    "userId" | "status" | "isGroup" | "aiAgentPaused"
  >,
  whatsapp?: Pick<Whatsapp, "aiAgentMode" | "aiAgentId" | "aiAgentEnabled"> | null
): boolean {
  if (ticket.userId != null) return false;
  if (ticket.isGroup) return false;
  if (ticket.status === "closed") return false;
  if (ticket.aiAgentPaused === true) return false;
  const mode = resolveWhatsappMode(whatsapp);
  if (mode !== "live") return false;
  return whatsapp?.aiAgentId != null;
}

export function isTicketInAutomationsColumn(input: ResolveInput): boolean {
  const { ticket } = input;
  if (ticket.userId != null || ticket.isGroup || ticket.status === "closed") {
    return false;
  }
  if (ticket.chatbot === true) {
    return true;
  }
  if (!isTicketAiAgentAutomationCandidate(ticket, input.whatsapp)) {
    return false;
  }
  return Boolean(
    input.hasAiAgentOutboundMessage || input.hasLiveRuntimeActivity
  );
}

export function resolveTicketAutomationState(
  input: ResolveInput
): TicketAutomationState {
  const { ticket, whatsapp, aiAgentName } = input;
  const aiAgentMode = resolveWhatsappMode(whatsapp);
  const paused = ticket.aiAgentPaused === true;

  const base: TicketAutomationState = {
    automationActive: false,
    automationType: null,
    automationLabel: null,
    aiAgentActive: false,
    aiAgentPaused: paused,
    aiAgentMode,
    aiAgentId: whatsapp?.aiAgentId ?? null,
    aiAgentName: aiAgentName ?? null
  };

  if (ticket.userId != null) {
    return { ...base, reason: "human_assigned" };
  }
  if (ticket.isGroup) {
    return { ...base, reason: "group" };
  }
  if (ticket.status === "closed") {
    return { ...base, reason: "closed" };
  }

  if (paused && aiAgentMode === "live") {
    return {
      ...base,
      automationLabel: "IA pausada",
      reason: "ai_paused"
    };
  }

  if (ticket.chatbot === true) {
    const flow = isFlowAutomationActive(ticket);
    let type: TicketAutomationType = "chatbot";
    if (flow.active) {
      type = "flowbuilder";
    } else {
      const integrationType = resolveIntegrationAutomationType(ticket);
      if (integrationType) {
        type = integrationType;
      }
    }
    return {
      ...base,
      automationActive: true,
      automationType: type,
      automationLabel: automationLabelForType(type)
    };
  }

  if (
    isTicketAiAgentAutomationCandidate(ticket, whatsapp) &&
    (input.hasAiAgentOutboundMessage || input.hasLiveRuntimeActivity)
  ) {
    return {
      ...base,
      automationActive: true,
      automationType: "ai_agent",
      automationLabel: "IA atendendo",
      aiAgentActive: true
    };
  }

  return { ...base, reason: "none" };
}

/** SQL para tickets com IA ativa na coluna Automações (companyId validado como número). */
export function buildAiAutomationTicketExistsSql(companyId: number): string {
  const cid = Number(companyId);
  return `(
    "Ticket"."userId" IS NULL
    AND ("Ticket"."aiAgentPaused" = false OR "Ticket"."aiAgentPaused" IS NULL)
    AND EXISTS (
      SELECT 1 FROM "Whatsapps" AS w
      WHERE w.id = "Ticket"."whatsappId"
        AND w."companyId" = ${cid}
        AND w."aiAgentMode" = 'live'
        AND w."aiAgentId" IS NOT NULL
    )
    AND (
      EXISTS (
        SELECT 1 FROM "Messages" AS m
        WHERE m."ticketId" = "Ticket"."id"
          AND m."companyId" = ${cid}
          AND m."messageOrigin" = 'ai_agent'
          AND m."fromMe" = true
      )
      OR EXISTS (
        SELECT 1 FROM "AiAgentRuntimeLogs" AS l
        WHERE l."ticketId" = "Ticket"."id"
          AND l."companyId" = ${cid}
          AND l."mode" = 'live'
          AND l."liveStatus" IN ('queued', 'generated', 'sending', 'sent')
      )
    )
  )`;
}
