import {
  AI_AGENT_EVALUATION_REASONS,
  AiAgentEvaluationMode,
  AiAgentEvaluationResult
} from "./aiAgentEvaluationReasons";
import {
  buildAiAgentRuntimeContext,
  AiAgentInboundChannel,
  AiAgentInboundMessageInput
} from "./buildAiAgentRuntimeContext";
import { shouldBypassChatbot } from "../../helpers/shouldBypassChatbot";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

export type EvaluateInboundMessageInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  message: AiAgentInboundMessageInput;
  channel?: AiAgentInboundChannel;
};

const MODE: AiAgentEvaluationMode = "dry_run";

function isCampaignOrSystemMessage(body?: string | null): boolean {
  if (!body || typeof body !== "string") return false;
  return body.includes("\u200c");
}

function hasActiveFlow(ticket: Ticket): boolean {
  const flowStopped = ticket.flowStopped;
  if (flowStopped == null) return false;
  const normalized = String(flowStopped).trim();
  return normalized !== "" && normalized !== "0";
}

function deny(
  reason: AiAgentEvaluationResult["reason"],
  aiAgentId?: number
): AiAgentEvaluationResult {
  return {
    eligible: false,
    reason,
    aiAgentId,
    mode: MODE
  };
}

function allow(aiAgentId: number): AiAgentEvaluationResult {
  return {
    eligible: true,
    reason: AI_AGENT_EVALUATION_REASONS.ELIGIBLE,
    aiAgentId,
    mode: MODE
  };
}

export default class AiAgentOrchestrator {
  static async evaluateInboundMessage(
    input: EvaluateInboundMessageInput
  ): Promise<AiAgentEvaluationResult> {
    try {
      const channel = input.channel ?? "whatsapp";
      if (channel !== "whatsapp") {
        return deny(AI_AGENT_EVALUATION_REASONS.UNSUPPORTED_CHANNEL);
      }

      const ctx = await buildAiAgentRuntimeContext({
        companyId: input.companyId,
        ticket: input.ticket,
        contact: input.contact,
        whatsapp: input.whatsapp,
        message: input.message,
        channel
      });

      if (!ctx.planHasAiAgent) {
        return deny(AI_AGENT_EVALUATION_REASONS.PLAN_DISABLED);
      }

      if (!ctx.whatsapp.aiAgentEnabled) {
        return deny(AI_AGENT_EVALUATION_REASONS.WHATSAPP_AI_AGENT_DISABLED);
      }

      if (ctx.whatsapp.aiAgentId == null) {
        return deny(AI_AGENT_EVALUATION_REASONS.WHATSAPP_AI_AGENT_MISSING);
      }

      if (!ctx.aiAgent) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.AI_AGENT_NOT_FOUND,
          ctx.whatsapp.aiAgentId
        );
      }

      if (!ctx.aiAgent.enabled) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.AI_AGENT_DISABLED,
          ctx.aiAgent.id
        );
      }

      if (input.message.fromMe === true) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.MESSAGE_FROM_ME,
          ctx.aiAgent.id
        );
      }

      if (ctx.ticket.isGroup) {
        return deny(AI_AGENT_EVALUATION_REASONS.GROUP_MESSAGE, ctx.aiAgent.id);
      }

      if (isCampaignOrSystemMessage(input.message.body)) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.CAMPAIGN_OR_SYSTEM_MESSAGE,
          ctx.aiAgent.id
        );
      }

      if (ctx.ticket.userId != null) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.TICKET_HAS_HUMAN_USER,
          ctx.aiAgent.id
        );
      }

      if (ctx.ticket.status === "closed") {
        return deny(AI_AGENT_EVALUATION_REASONS.TICKET_CLOSED, ctx.aiAgent.id);
      }

      if (ctx.ticket.chatbot === true) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.TICKET_CHATBOT_ACTIVE,
          ctx.aiAgent.id
        );
      }

      if (hasActiveFlow(ctx.ticket)) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.TICKET_FLOW_ACTIVE,
          ctx.aiAgent.id
        );
      }

      if (ctx.ticket.useIntegration === true) {
        return deny(
          AI_AGENT_EVALUATION_REASONS.TICKET_INTEGRATION_ACTIVE,
          ctx.aiAgent.id
        );
      }

      const bypassDecision = await shouldBypassChatbot({
        companyId: input.companyId,
        contact: input.contact,
        queueId: ctx.ticket.queueId,
        ticketId: ctx.ticket.id
      });
      if (bypassDecision.bypass) {
        return deny(AI_AGENT_EVALUATION_REASONS.CHATBOT_BYPASS, ctx.aiAgent.id);
      }

      return allow(ctx.aiAgent.id);
    } catch (err) {
      logger.warn(
        {
          err,
          companyId: input.companyId,
          ticketId: input.ticket?.id,
          messageId: input.message?.id
        },
        "[AiAgent][dry_run] evaluation_failed"
      );
      return deny(AI_AGENT_EVALUATION_REASONS.UNEXPECTED_ERROR);
    }
  }
}
