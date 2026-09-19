import { logger } from "../../../utils/logger";
import { NormalizedWhatsAppMessage } from "../inbound/NormalizedWhatsAppMessage";
import { dispatchInboundTypebot } from "../../../services/TypebotServices/dispatchInboundTypebot";
import { dispatchInboundQueueRouting } from "../../../services/ChatbotServices/dispatchInboundQueueRouting";
import { dispatchInboundFlow } from "../../../services/FlowBuilderService/dispatchInboundFlow";
import type { TypebotLegacyMediaCapability } from "../../../services/TypebotServices/typebotLegacyMedia";
import type { QueueMenuRenderCapability } from "../../../services/ChatbotServices/queueMenuText";

/**
 * 12.3-B — Automation Inbound Boundary
 *
 * provider inbound persistido
 *   → processInboundAutomation (este módulo)
 *   → Chatbot / Typebot / Flow
 *
 * O core NÃO exige sessão WhatsApp in-memory nem payload cru de provider.
 * 12.3-C: Typebot textual (WhatsAppOutbound).
 * 12.3-D: Chatbot / Queue Routing (WhatsAppOutbound + fallback textual).
 * 12.3-E: Flow Builder textual/domínio (WhatsAppOutbound).
 * OpenAI legado/n8n/mídia audio Evolution continuam deferidos.
 */

export const SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS = [
  "handleMessageIntegration",
  "handleOpenAi",
  "outOfHoursMessage",
  "greetingMessage"
] as const;

export type InboundAutomationSkipReason =
  | "group"
  | "fromMe"
  | "reaction"
  | "tenant_mismatch"
  | "whatsapp_mismatch"
  | "ticket_contact_mismatch"
  | "missing_ticket"
  | "missing_contact"
  | "not_persisted"
  | "internal_error";

export type InboundAutomationTicket = {
  id: number;
  companyId: number;
  whatsappId: number;
  contactId: number;
  isGroup: boolean;
  queueId?: number | null;
  queueOptionId?: number | null;
  userId?: number | null;
  chatbot?: boolean | null;
  useIntegration?: boolean | null;
  integrationId?: number | null;
  promptId?: number | null;
  typebotSessionId?: string | null;
  typebotStatus?: boolean | null;
  flowWebhook?: boolean | null;
  lastFlowId?: string | number | null;
  flowStopped?: string | number | null;
  hashFlowId?: string | null;
  dataWebhook?: unknown;
  status?: string | null;
};

export type InboundAutomationContact = {
  id: number;
  companyId: number;
};

export type InboundAutomationWhatsapp = {
  id: number;
  companyId: number;
  integrationId?: number | null;
  promptId?: number | null;
};

export type InboundAutomationContext = {
  inbound: NormalizedWhatsAppMessage;
  ticket: InboundAutomationTicket;
  contact: InboundAutomationContact;
  whatsapp: InboundAutomationWhatsapp;
  persistedMessageId: string;
};

export type InboundAutomationSnapshot = {
  companyId: number;
  whatsappId: number;
  ticketId: number;
  contactId: number;
  messageId: string;
  persistedMessageId: string;
  provider: NormalizedWhatsAppMessage["provider"];
  fromMe: boolean;
  isGroup: boolean;
};

export type InboundAutomationCapabilities = {
  /**
   * SOMENTE o caller Baileys. Evolution omite.
   * Executa consumidores ainda acoplados ao adapter Baileys.
   */
  runSocketBoundConsumers?: () => Promise<void>;
  /**
   * Caller Baileys: mídia Typebot por URL. Evolution omite.
   */
  typebotLegacyMedia?: TypebotLegacyMediaCapability;
  /**
   * Caller Baileys: buttons/list. Evolution omite (fallback textual).
   */
  queueMenuRender?: QueueMenuRenderCapability;
  /**
   * Caller Baileys: deixa continuação do node OpenAI no listener legado.
   */
  legacyOpenAiNode?: boolean;
};

export type ProcessInboundAutomationResult =
  | {
      status: "skipped";
      reason: InboundAutomationSkipReason;
      context: InboundAutomationSnapshot | null;
    }
  | {
      status: "ready";
      context: InboundAutomationSnapshot;
      intendedConsumers: string[];
      socketBoundConsumers: readonly string[];
    }
  | {
      status: "executed";
      consumer: "typebot" | "queue_routing" | "flow";
      halt: boolean;
      startedTypebot?: boolean;
      startedFlow?: boolean;
      deferredIntegration?: string;
      deferredOpenAi?: boolean;
      context: InboundAutomationSnapshot;
      intendedConsumers: string[];
      socketBoundConsumers: readonly string[];
    }
  | {
      status: "executed_socket_bound";
      context: InboundAutomationSnapshot;
      intendedConsumers: string[];
      socketBoundConsumers: readonly string[];
    };

export function snapshotInboundAutomationContext(
  ctx: InboundAutomationContext
): InboundAutomationSnapshot {
  return {
    companyId: ctx.inbound.companyId,
    whatsappId: ctx.inbound.whatsappId,
    ticketId: ctx.ticket.id,
    contactId: ctx.contact.id,
    messageId: ctx.inbound.messageId,
    persistedMessageId: ctx.persistedMessageId,
    provider: ctx.inbound.provider,
    fromMe: ctx.inbound.fromMe,
    isGroup: ctx.inbound.isGroup
  };
}

export function classifyIntendedAutomationConsumers(
  ticket: InboundAutomationTicket,
  whatsapp: InboundAutomationWhatsapp
): string[] {
  const out: string[] = [];
  const noQueue = ticket.queueId == null;
  const noUser = ticket.userId == null;

  if (noQueue && noUser && whatsapp.promptId != null) {
    out.push("handleOpenAi");
  }
  if (
    noQueue &&
    noUser &&
    whatsapp.integrationId != null &&
    !ticket.useIntegration
  ) {
    out.push("handleMessageIntegration");
  }
  if (
    !noQueue &&
    noUser &&
    ticket.useIntegration &&
    ticket.integrationId != null
  ) {
    out.push("handleMessageIntegration");
  }
  if (noQueue && noUser && !ticket.useIntegration) {
    out.push("verifyQueue");
  }
  if (ticket.chatbot && !noQueue && noUser) {
    out.push("handleChartbot");
  }
  if (ticket.promptId != null && ticket.useIntegration && !noQueue && noUser) {
    out.push("handleOpenAi");
  }

  return Array.from(new Set(out));
}

export function evaluateInboundAutomationEligibility(
  ctx: InboundAutomationContext
): { ok: true } | { ok: false; reason: InboundAutomationSkipReason } {
  if (ctx.ticket == null || ctx.ticket.id == null) {
    return { ok: false, reason: "missing_ticket" };
  }
  if (ctx.contact == null || ctx.contact.id == null) {
    return { ok: false, reason: "missing_contact" };
  }
  if (!ctx.persistedMessageId) {
    return { ok: false, reason: "not_persisted" };
  }

  if ((ctx.inbound.kind || "message") === "reaction") {
    return { ok: false, reason: "reaction" };
  }

  if (ctx.inbound.fromMe) {
    return { ok: false, reason: "fromMe" };
  }

  if (ctx.inbound.isGroup || ctx.ticket.isGroup) {
    return { ok: false, reason: "group" };
  }

  if (ctx.ticket.companyId !== ctx.inbound.companyId) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  if (
    ctx.contact.companyId != null &&
    ctx.contact.companyId !== ctx.inbound.companyId
  ) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  if (
    ctx.whatsapp.companyId != null &&
    ctx.whatsapp.companyId !== ctx.inbound.companyId
  ) {
    return { ok: false, reason: "tenant_mismatch" };
  }

  if (ctx.whatsapp.id !== ctx.inbound.whatsappId) {
    return { ok: false, reason: "whatsapp_mismatch" };
  }
  if (
    ctx.ticket.whatsappId != null &&
    ctx.ticket.whatsappId !== ctx.inbound.whatsappId
  ) {
    return { ok: false, reason: "whatsapp_mismatch" };
  }

  if (ctx.ticket.contactId != null && ctx.ticket.contactId !== ctx.contact.id) {
    return { ok: false, reason: "ticket_contact_mismatch" };
  }

  return { ok: true };
}

function emptySnapshot(
  inbound: NormalizedWhatsAppMessage | undefined
): InboundAutomationSnapshot | null {
  if (!inbound) return null;
  return {
    companyId: inbound.companyId,
    whatsappId: inbound.whatsappId,
    ticketId: 0,
    contactId: 0,
    messageId: inbound.messageId,
    persistedMessageId: "",
    provider: inbound.provider,
    fromMe: inbound.fromMe,
    isGroup: inbound.isGroup
  };
}

/**
 * Gate provider-agnostic de automação inbound.
 * Não envia WhatsApp. Não resolve sessão de provider.
 */
export async function processInboundAutomation(
  ctx: InboundAutomationContext,
  capabilities?: InboundAutomationCapabilities
): Promise<ProcessInboundAutomationResult> {
  try {
    const eligibility = evaluateInboundAutomationEligibility(ctx);
    const context = snapshotInboundAutomationContext(ctx);

    if (eligibility.ok === false) {
      logger.info(
        {
          inboundAutomation: true,
          status: "skipped",
          reason: eligibility.reason,
          ...context
        },
        "[InboundAutomation] skipped"
      );
      return {
        status: "skipped",
        reason: eligibility.reason,
        context
      };
    }

    const intendedConsumers = classifyIntendedAutomationConsumers(
      ctx.ticket,
      ctx.whatsapp
    );

    logger.info(
      {
        inboundAutomation: true,
        status: "ready",
        intendedConsumers,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS,
        hasSocketBoundRunner: Boolean(capabilities?.runSocketBoundConsumers),
        ...context
      },
      "[InboundAutomation] ready"
    );

    const typebotDispatch = await dispatchInboundTypebot(ctx, {
      media: capabilities?.typebotLegacyMedia
    });
    if (typebotDispatch.handled) {
      logger.info(
        {
          inboundAutomation: true,
          status: "executed",
          consumer: "typebot",
          halt: typebotDispatch.halt,
          reason: typebotDispatch.reason,
          ...context
        },
        "[InboundAutomation] typebot executed"
      );
      return {
        status: "executed",
        consumer: "typebot",
        halt: typebotDispatch.halt,
        startedTypebot: true,
        context,
        intendedConsumers,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
      };
    }

    const flowDispatch = await dispatchInboundFlow(ctx, {
      legacyOpenAiNode: capabilities?.legacyOpenAiNode
    });
    if (flowDispatch.handled) {
      logger.info(
        {
          inboundAutomation: true,
          status: "executed",
          consumer: "flow",
          halt: false,
          startedFlow: flowDispatch.startedFlow,
          deferredOpenAi: flowDispatch.deferredOpenAi,
          reason: flowDispatch.reason,
          ...context
        },
        "[InboundAutomation] flow executed"
      );
      return {
        status: "executed",
        consumer: "flow",
        halt: false,
        startedFlow: flowDispatch.startedFlow,
        deferredOpenAi: flowDispatch.deferredOpenAi,
        context,
        intendedConsumers,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
      };
    }

    const queueDispatch = await dispatchInboundQueueRouting(ctx, {
      media: capabilities?.typebotLegacyMedia,
      menuRender: capabilities?.queueMenuRender
    });
    if (queueDispatch.handled) {
      logger.info(
        {
          inboundAutomation: true,
          status: "executed",
          consumer: "queue_routing",
          halt: false,
          startedTypebot: queueDispatch.startedTypebot,
          startedFlow: queueDispatch.startedFlow,
          deferredIntegration: queueDispatch.deferredIntegration,
          reason: queueDispatch.reason,
          ...context
        },
        "[InboundAutomation] queue routing executed"
      );
      return {
        status: "executed",
        consumer: "queue_routing",
        halt: false,
        startedTypebot: queueDispatch.startedTypebot,
        startedFlow: queueDispatch.startedFlow,
        deferredIntegration: queueDispatch.deferredIntegration,
        context,
        intendedConsumers,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
      };
    }

    if (capabilities?.runSocketBoundConsumers) {
      await capabilities.runSocketBoundConsumers();
      return {
        status: "executed_socket_bound",
        context,
        intendedConsumers,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
      };
    }

    logger.info(
      {
        inboundAutomation: true,
        status: "ready",
        deferred: true,
        socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS,
        ...context
      },
      "[InboundAutomation] socket-bound consumers deferred (12.3-B)"
    );

    return {
      status: "ready",
      context,
      intendedConsumers,
      socketBoundConsumers: SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
    };
  } catch (err) {
    logger.error(
      { err, messageId: ctx?.inbound?.messageId },
      "[InboundAutomation] unexpected error"
    );
    return {
      status: "skipped",
      reason: "internal_error",
      context: ctx?.inbound ? emptySnapshot(ctx.inbound) : null
    };
  }
}
