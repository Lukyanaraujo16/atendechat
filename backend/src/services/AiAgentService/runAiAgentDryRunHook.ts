import { proto } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import AiAgentOrchestrator from "./AiAgentOrchestrator";
import { InboundMessageClassification } from "./classifyInboundMessage";
import {
  findAiAgentRuntimeLogByMessageKey,
  persistAiAgentRuntimeLog,
  shouldPersistAiAgentRuntimeLog
} from "./AiAgentRuntimeLogService";
import { resolveInboundMessageId } from "./resolveInboundMessageId";
import { sanitizeAiAgentRuntimeMetadata } from "./sanitizeAiAgentRuntimeMetadata";
import { logger } from "../../utils/logger";

export type RunAiAgentDryRunHookInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  baileysMessageId?: string | null;
  persistedMessageId?: string | null;
  fromMe: boolean;
  isGroup: boolean;
  body?: string | null;
  classification: InboundMessageClassification;
};

/**
 * Avalia elegibilidade do Agente de IA (dry-run) após persistir mensagem inbound.
 * Não altera ticket, não envia resposta e não chama OpenAI.
 */
export async function runAiAgentDryRunHook(
  input: RunAiAgentDryRunHookInput
): Promise<void> {
  const resolvedId = resolveInboundMessageId({
    baileysMessageId: input.baileysMessageId,
    persistedMessageId: input.persistedMessageId
  });

  if (resolvedId.messageId) {
    const duplicate = await findAiAgentRuntimeLogByMessageKey({
      companyId: input.companyId,
      whatsappId: input.whatsapp.id,
      channel: "whatsapp",
      messageId: resolvedId.messageId
    });
    if (duplicate) {
      logger.info(
        {
          companyId: input.companyId,
          ticketId: input.ticket.id,
          whatsappId: input.whatsapp.id,
          messageId: resolvedId.messageId,
          existingLogId: duplicate.id
        },
        "[AiAgent][dry_run] duplicate_message"
      );
      return;
    }
  }

  const evaluation = await AiAgentOrchestrator.evaluateInboundMessage({
    companyId: input.companyId,
    ticket: input.ticket,
    contact: input.contact,
    whatsapp: input.whatsapp,
    message: {
      id: resolvedId.messageId,
      fromMe: input.fromMe,
      body: input.body,
      classification: input.classification
    },
    persistedMessageId: input.persistedMessageId,
    channel: "whatsapp"
  });

  const baseMetadata = sanitizeAiAgentRuntimeMetadata({
    messageType: input.classification.messageType,
    hasText: input.classification.hasText,
    hasMedia: input.classification.hasMedia,
    messageIdSource: resolvedId.source,
    ticketStatus: input.ticket.status,
    hasUser: input.ticket.userId != null,
    ticketChatbot: input.ticket.chatbot === true,
    ticketQueueId: input.ticket.queueId ?? null,
    isGroup: input.isGroup
  });

  if (!shouldPersistAiAgentRuntimeLog(input.whatsapp, evaluation.reason)) {
    logger.debug(
      {
        companyId: input.companyId,
        ticketId: input.ticket.id,
        whatsappId: input.whatsapp.id,
        messageId: resolvedId.messageId,
        eligible: evaluation.eligible,
        reason: evaluation.reason
      },
      "[AiAgent][dry_run] evaluation_skipped_persist"
    );
    return;
  }

  await persistAiAgentRuntimeLog({
    companyId: input.companyId,
    ticketId: input.ticket.id,
    contactId: input.contact.id,
    whatsappId: input.whatsapp.id,
    channel: "whatsapp",
    evaluation,
    messageId: resolvedId.messageId,
    metadata: baseMetadata
  });
}

/** Helper para o hook no listener — classifica e dispara dry-run sem bloquear fluxo legado. */
export function scheduleAiAgentDryRunFromInbound(params: {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  msg: proto.IWebMessageInfo;
  bodyMessage?: string | null;
  persistedMessageId?: string | null;
  classification: InboundMessageClassification;
}): void {
  void runAiAgentDryRunHook({
    companyId: params.companyId,
    ticket: params.ticket,
    contact: params.contact,
    whatsapp: params.whatsapp,
    baileysMessageId:
      params.msg.key?.id != null && String(params.msg.key.id).length > 0
        ? String(params.msg.key.id)
        : null,
    persistedMessageId: params.persistedMessageId ?? null,
    fromMe: false,
    isGroup: !!params.ticket.isGroup,
    body: params.bodyMessage ?? null,
    classification: params.classification
  }).catch((err) => {
    logger.warn(
      {
        err,
        companyId: params.companyId,
        ticketId: params.ticket.id,
        messageId: params.msg.key?.id ?? null
      },
      "[AiAgent][dry_run] hook_failed"
    );
  });
}
