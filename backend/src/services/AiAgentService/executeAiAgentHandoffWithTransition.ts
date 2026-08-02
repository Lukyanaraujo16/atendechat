import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import applyAiAgentHandoffToTicket from "./applyAiAgentHandoffToTicket";
import { buildAiAgentHandoffTransitionMessage } from "./buildAiAgentHandoffTransitionMessage";
import { formatAiAgentSignedMessage } from "./formatAiAgentSignedMessage";
import sendAiAgentWhatsappMessage from "./sendAiAgentWhatsappMessage";

export type ExecuteAiAgentHandoffWithTransitionInput = {
  ticket: Ticket;
  companyId: number;
  aiAgentId: number;
  agentName: string;
  aiAgentRuntimeLogId: number | null;
  reason: string;
  configuredHandoffMessage?: string | null;
  tone?: string | null;
  /** Texto do modelo (já sem marcador), se houver. */
  modelCleanText?: string | null;
  by?: string;
};

export type ExecuteAiAgentHandoffWithTransitionResult =
  | {
      ok: true;
      transitionSent: true;
      messageId: string;
      transitionBody: string;
    }
  | {
      ok: false;
      transitionSent: false;
      error: string;
      blockedHandoff: true;
    };

/**
 * Contrato: mensagem de transição assinada → envio → só então handoff.
 * Se o envio falhar, NÃO aplica handoff (impede transferência silenciosa).
 * Idempotência: applyAiAgentHandoffToTicket já é no-op se handoff já solicitado.
 */
export default async function executeAiAgentHandoffWithTransition(
  input: ExecuteAiAgentHandoffWithTransitionInput
): Promise<ExecuteAiAgentHandoffWithTransitionResult> {
  if (input.ticket.aiAgentHandoffRequested === true) {
    return {
      ok: true,
      transitionSent: true,
      messageId: "already_handed_off",
      transitionBody: ""
    };
  }

  const transitionText = buildAiAgentHandoffTransitionMessage({
    reason: input.reason,
    configuredHandoffMessage: input.configuredHandoffMessage,
    tone: input.tone,
    modelCleanText: input.modelCleanText
  });

  const signed = formatAiAgentSignedMessage({
    agentName: input.agentName,
    content: transitionText
  });

  if (!signed.body) {
    logger.warn(
      {
        event: "ai_agent.handoff_failed",
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.aiAgentId,
        reason: input.reason,
        result: "empty_transition"
      },
      "ai_agent.handoff_failed"
    );
    return {
      ok: false,
      transitionSent: false,
      error: "empty_transition",
      blockedHandoff: true
    };
  }

  logger.info(
    {
      event: "ai_agent.handoff_decided",
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.aiAgentId,
      reason: input.reason,
      result: "pending_send"
    },
    "ai_agent.handoff_decided"
  );

  const sendResult = await sendAiAgentWhatsappMessage({
    ticket: input.ticket,
    body: signed.body,
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    aiAgentRuntimeLogId: input.aiAgentRuntimeLogId,
    alreadySigned: true
  });

  if (sendResult.ok === false) {
    logger.warn(
      {
        event: "ai_agent.handoff_failed",
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.aiAgentId,
        reason: input.reason,
        result: "transition_send_failed",
        attempt: 1
      },
      "ai_agent.handoff_failed"
    );
    return {
      ok: false,
      transitionSent: false,
      error: sendResult.error,
      blockedHandoff: true
    };
  }

  logger.info(
    {
      event: "ai_agent.handoff_transition_sent",
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.aiAgentId,
      channel: "whatsapp",
      reason: input.reason,
      result: "ok"
    },
    "ai_agent.handoff_transition_sent"
  );

  await applyAiAgentHandoffToTicket({
    ticket: input.ticket,
    companyId: input.companyId,
    reason: input.reason,
    by: input.by ?? "ai_agent"
  });

  logger.info(
    {
      event: "ai_agent.handoff_completed",
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.aiAgentId,
      reason: input.reason,
      result: "ok"
    },
    "ai_agent.handoff_completed"
  );

  return {
    ok: true,
    transitionSent: true,
    messageId: sendResult.messageId,
    transitionBody: signed.body
  };
}
