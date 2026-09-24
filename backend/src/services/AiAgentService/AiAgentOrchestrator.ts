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
import { isFlowAutomationActive } from "./isFlowAutomationActive";
import { isTicketIntegrationActive } from "./isTicketIntegrationActive";
import {
  isCampaignOrSystemText,
  InboundMessageClassification
} from "./classifyInboundMessage";
import { resolveInboundMessageId } from "./resolveInboundMessageId";
import { AI_AGENT_EVALUATOR_VERSION } from "./aiAgentDryRunConfig";
import { resolveWhatsappAiAgentRuntimeMode, isAiAgentRuntimeActive } from "./aiAgentRuntimeMode";
import { checkAiAgentLiveLimits } from "./checkAiAgentLiveLimits";
import { maybeApplySafetyHandoffForLiveBlock } from "./maybeApplySafetyHandoffForLiveBlock";

export type EvaluateInboundMessageInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  message: AiAgentInboundMessageInput;
  channel?: AiAgentInboundChannel;
  persistedMessageId?: string | null;
};

function resolveEvaluationMode(
  whatsapp: Whatsapp
): AiAgentEvaluationMode {
  const runtimeMode = resolveWhatsappAiAgentRuntimeMode(whatsapp);
  if (runtimeMode === "shadow") return "shadow";
  if (runtimeMode === "live") return "live";
  return "dry_run";
}

function deny(
  reason: AiAgentEvaluationResult["reason"],
  mode: AiAgentEvaluationMode,
  aiAgentId?: number,
  metadata?: Record<string, unknown>,
  evaluationDurationMs?: number
): AiAgentEvaluationResult {
  return {
    eligible: false,
    reason,
    aiAgentId,
    mode,
    metadata,
    evaluationDurationMs
  };
}

function allow(
  aiAgentId: number,
  mode: AiAgentEvaluationMode,
  metadata?: Record<string, unknown>,
  evaluationDurationMs?: number
): AiAgentEvaluationResult {
  return {
    eligible: true,
    reason: AI_AGENT_EVALUATION_REASONS.ELIGIBLE,
    aiAgentId,
    mode,
    metadata,
    evaluationDurationMs
  };
}

function baseMessageMetadata(
  classification: InboundMessageClassification,
  messageIdSource: string
): Record<string, unknown> {
  return {
    messageType: classification.messageType,
    hasText: classification.hasText,
    hasMedia: classification.hasMedia,
    messageIdSource,
    evaluatorVersion: AI_AGENT_EVALUATOR_VERSION
  };
}

export default class AiAgentOrchestrator {
  static async evaluateInboundMessage(
    input: EvaluateInboundMessageInput
  ): Promise<AiAgentEvaluationResult> {
    const startedAt = Date.now();
    const finish = (
      result: AiAgentEvaluationResult
    ): AiAgentEvaluationResult => ({
      ...result,
      evaluationDurationMs: Date.now() - startedAt
    });

    try {
      const channel = input.channel ?? "whatsapp";
      const evaluationMode = resolveEvaluationMode(input.whatsapp);

      // 1. Canal suportado
      if (channel !== "whatsapp") {
        return finish(
          deny(AI_AGENT_EVALUATION_REASONS.UNSUPPORTED_CHANNEL, evaluationMode)
        );
      }

      // 2. Identificação da mensagem
      const resolvedId = resolveInboundMessageId({
        baileysMessageId: input.message.id,
        persistedMessageId: input.persistedMessageId
      });
      if (!resolvedId.messageId) {
        return finish(
          deny(AI_AGENT_EVALUATION_REASONS.MESSAGE_ID_MISSING, evaluationMode, undefined, {
            messageIdSource: resolvedId.source,
            evaluatorVersion: AI_AGENT_EVALUATOR_VERSION
          })
        );
      }

      const classification =
        input.message.classification;
      if (!classification) {
        return finish(deny(AI_AGENT_EVALUATION_REASONS.UNEXPECTED_ERROR, evaluationMode));
      }

      // 3. fromMe
      if (input.message.fromMe === true) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.MESSAGE_FROM_ME,
            evaluationMode,
            undefined,
            baseMessageMetadata(classification, resolvedId.source)
          )
        );
      }

      // 4. Tipo de mensagem
      if (classification.blockReason) {
        return finish(
          deny(
            classification.blockReason,
            evaluationMode,
            undefined,
            baseMessageMetadata(classification, resolvedId.source)
          )
        );
      }

      if (isCampaignOrSystemText(input.message.body)) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.CAMPAIGN_OR_SYSTEM_MESSAGE,
            evaluationMode,
            undefined,
            baseMessageMetadata(classification, resolvedId.source)
          )
        );
      }

      // 5. Grupo
      if (input.ticket.isGroup) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.GROUP_MESSAGE,
            evaluationMode,
            undefined,
            baseMessageMetadata(classification, resolvedId.source)
          )
        );
      }

      const ctx = await buildAiAgentRuntimeContext({
        companyId: input.companyId,
        ticket: input.ticket,
        contact: input.contact,
        whatsapp: input.whatsapp,
        message: input.message,
        channel
      });

      const msgMeta = baseMessageMetadata(classification, resolvedId.source);
      const runtimeMode = resolveWhatsappAiAgentRuntimeMode(ctx.whatsapp);

      // 6. Plano
      if (!ctx.planHasAiAgent) {
        return finish(
          deny(AI_AGENT_EVALUATION_REASONS.PLAN_DISABLED, evaluationMode, undefined, msgMeta)
        );
      }

      // 7. Conexão habilitada (dry_run ou shadow)
      if (!isAiAgentRuntimeActive(runtimeMode)) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.WHATSAPP_AI_AGENT_DISABLED,
            evaluationMode,
            undefined,
            msgMeta
          )
        );
      }

      // 8. Agente configurado
      if (ctx.whatsapp.aiAgentId == null) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.WHATSAPP_AI_AGENT_MISSING,
            evaluationMode,
            undefined,
            msgMeta
          )
        );
      }

      // 9. Agente existente/ativo/mesma empresa
      if (!ctx.aiAgent) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.AI_AGENT_NOT_FOUND,
            evaluationMode,
            ctx.whatsapp.aiAgentId,
            msgMeta
          )
        );
      }

      if (!ctx.aiAgent.enabled) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.AI_AGENT_DISABLED,
            evaluationMode,
            ctx.aiAgent.id,
            msgMeta
          )
        );
      }

      // 10. Ticket válido
      if (ctx.ticket.status === "closed") {
        return finish(
          deny(AI_AGENT_EVALUATION_REASONS.TICKET_CLOSED, evaluationMode, ctx.aiAgent.id, {
            ...msgMeta,
            ticketStatus: ctx.ticket.status
          })
        );
      }

      // 11. Atendimento humano
      if (ctx.ticket.userId != null) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.TICKET_HAS_HUMAN_USER,
            evaluationMode,
            ctx.aiAgent.id,
            {
              ...msgMeta,
              ticketStatus: ctx.ticket.status,
              hasUser: true
            }
          )
        );
      }

      // 12. Bypass de chatbot
      const bypassDecision = await shouldBypassChatbot({
        companyId: input.companyId,
        contact: input.contact,
        queueId: ctx.ticket.queueId,
        ticketId: ctx.ticket.id
      });
      if (bypassDecision.bypass) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.CHATBOT_BYPASS,
            evaluationMode,
            ctx.aiAgent.id,
            msgMeta
          )
        );
      }

      // 13. Chatbot tradicional
      if (ctx.ticket.chatbot === true) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.TICKET_CHATBOT_ACTIVE,
            evaluationMode,
            ctx.aiAgent.id,
            {
              ...msgMeta,
              ticketChatbot: true
            }
          )
        );
      }

      // 14. FlowBuilder realmente ativo
      const flowState = isFlowAutomationActive(ctx.ticket);
      if (flowState.active) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.TICKET_FLOW_ACTIVE,
            evaluationMode,
            ctx.aiAgent.id,
            {
              ...msgMeta,
              flowWebhook: true,
              hasFlowId: true,
              flowEvidence: flowState.evidence
            }
          )
        );
      }

      // 15. Integração realmente ativa
      const integrationState = await isTicketIntegrationActive(ctx.ticket);
      if (integrationState.active) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.TICKET_INTEGRATION_ACTIVE,
            evaluationMode,
            ctx.aiAgent.id,
            {
              ...msgMeta,
              integrationType: integrationState.reason ?? "integration",
              integrationEvidence: integrationState.evidence
            }
          )
        );
      }

      // 16. Live: handoff solicitado
      if (
        runtimeMode === "live" &&
        ctx.ticket.aiAgentHandoffRequested === true
      ) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.AI_AGENT_HANDOFF_REQUESTED,
            evaluationMode,
            ctx.aiAgent.id,
            msgMeta
          )
        );
      }

      // 17. Live: IA pausada no ticket
      if (runtimeMode === "live" && ctx.ticket.aiAgentPaused === true) {
        return finish(
          deny(
            AI_AGENT_EVALUATION_REASONS.TICKET_AI_PAUSED,
            evaluationMode,
            ctx.aiAgent.id,
            msgMeta
          )
        );
      }

      // 18. Live: limites de segurança por ticket
      if (runtimeMode === "live") {
        const liveLimits = await checkAiAgentLiveLimits({
          companyId: input.companyId,
          ticketId: ctx.ticket.id,
          aiAgentCycleStartedAt: ctx.ticket.aiAgentCycleStartedAt
        });
        if (liveLimits.allowed === false) {
          await maybeApplySafetyHandoffForLiveBlock({
            ticket: ctx.ticket,
            companyId: input.companyId,
            errorCode: liveLimits.errorCode,
            agent: ctx.aiAgent
          });
          return finish(
            deny(
              liveLimits.errorCode as AiAgentEvaluationResult["reason"],
              evaluationMode,
              ctx.aiAgent.id,
              msgMeta
            )
          );
        }
      }

      // 19. Elegível
      return finish(
        allow(ctx.aiAgent.id, evaluationMode, {
          ...msgMeta,
          ticketStatus: ctx.ticket.status,
          hasUser: false,
          ticketChatbot: false
        })
      );
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
      return finish(
        deny(
          AI_AGENT_EVALUATION_REASONS.UNEXPECTED_ERROR,
          resolveEvaluationMode(input.whatsapp)
        )
      );
    }
  }
}
