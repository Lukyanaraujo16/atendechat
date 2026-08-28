import { UniqueConstraintError } from "sequelize";
import Whatsapp from "../../../../../models/Whatsapp";
import EvolutionWebhookEvent from "../../../../../models/EvolutionWebhookEvent";
import { isEvolutionConnection } from "../../../connectionProvider";
import { logger } from "../../../../../utils/logger";
import { applyNormalizedMessageStatus } from "../../../inbound/applyNormalizedMessageStatus";
import {
  adaptEvolutionInboundMessage,
  buildEvolutionExternalEventId
} from "./adaptEvolutionInboundMessage";
import {
  adaptEvolutionMessageStatus,
  buildEvolutionAckExternalEventId
} from "./adaptEvolutionMessageStatus";
import {
  EvolutionWebhookEnvelope,
  isEvolutionConnectionUpdateEvent,
  isEvolutionMessageUpdateEvent,
  isEvolutionMessageUpsertEvent,
  isEvolutionQrcodeUpdatedEvent,
  sanitizeEvolutionWebhookPayload
} from "./evolutionWebhookTypes";
import { processEvolutionTextInbound } from "./processEvolutionTextInbound";
import {
  processEvolutionConnectionUpdate,
  processEvolutionQrcodeUpdated
} from "../lifecycle/processEvolutionConnectionWebhook";

const MAX_BODY_CHARS = 20000;

export type ProcessEvolutionWebhookResult = {
  outcome:
    | "processed"
    | "duplicate"
    | "ignored_event"
    | "skipped"
    | "deferred"
    | "error";
  reason?: string;
  messageId?: string;
  ticketId?: number;
  webhookEventId?: number;
  ack?: number;
};

async function processEvolutionStatusUpdate(input: {
  whatsapp: Whatsapp;
  envelope: EvolutionWebhookEnvelope;
  sanitized: Record<string, unknown>;
  apiKeyValid: boolean;
  eventType: string;
}): Promise<ProcessEvolutionWebhookResult> {
  const { whatsapp, envelope, sanitized, apiKeyValid, eventType } = input;

  const adapted = adaptEvolutionMessageStatus({
    envelope,
    companyId: whatsapp.companyId,
    whatsappId: whatsapp.id
  });

  const providerMessageId = adapted.ok ? adapted.status.messageId : null;

  const externalEventId = adapted.ok
    ? buildEvolutionAckExternalEventId({
        whatsappId: whatsapp.id,
        messageId: adapted.status.messageId,
        ack: adapted.status.ack,
        providerStatus: adapted.status.providerStatus
      })
    : buildEvolutionExternalEventId({
        whatsappId: whatsapp.id,
        messageId: null,
        eventType,
        payloadHashSeed: JSON.stringify(sanitized).slice(0, 2000)
      });

  let webhookEvent: EvolutionWebhookEvent;
  try {
    webhookEvent = await EvolutionWebhookEvent.create({
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      eventType,
      externalEventId,
      providerMessageId,
      processingStatus: "received",
      apiKeyValid,
      processed: false,
      rawPayload: sanitized,
      receivedAt: new Date()
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return {
        outcome: "duplicate",
        reason: "webhook_event_replay",
        messageId: providerMessageId || undefined
      };
    }
    throw err;
  }

  if (adapted.ok === false) {
    await webhookEvent.update({
      processed: true,
      processingStatus: "skipped",
      skipReason: adapted.reason,
      errorSummary: adapted.detail?.slice(0, 500) || null
    });
    return {
      outcome: "skipped",
      reason: adapted.reason,
      webhookEventId: webhookEvent.id,
      messageId: providerMessageId || undefined
    };
  }

  try {
    const applied = await applyNormalizedMessageStatus(adapted.status);

    if (applied.outcome === "deferred") {
      // ACK antes da Message: registra evento, não cria Message/Ticket/Contact.
      await webhookEvent.update({
        processed: true,
        processingStatus: "deferred",
        skipReason: "message_not_found"
      });
      return {
        outcome: "deferred",
        reason: "message_not_found",
        messageId: adapted.status.messageId,
        webhookEventId: webhookEvent.id,
        ack: adapted.status.ack
      };
    }

    if (applied.outcome === "skipped") {
      await webhookEvent.update({
        processed: true,
        processingStatus: "skipped",
        skipReason: applied.reason
      });
      return {
        outcome: "skipped",
        reason: applied.reason,
        messageId: adapted.status.messageId,
        webhookEventId: webhookEvent.id
      };
    }

    await webhookEvent.update({
      processed: true,
      processingStatus:
        applied.outcome === "noop_same_or_lower" ? "duplicate" : "processed",
      skipReason:
        applied.outcome === "noop_same_or_lower" ? "ack_monotonic_noop" : null
    });

    logger.info(
      {
        whatsappId: whatsapp.id,
        companyId: whatsapp.companyId,
        messageId: adapted.status.messageId,
        ack: adapted.status.ack,
        applyOutcome: applied.outcome,
        eventType
      },
      "[EvolutionWebhook] status update"
    );

    return {
      outcome: "processed",
      reason: applied.outcome,
      messageId: adapted.status.messageId,
      webhookEventId: webhookEvent.id,
      ack: adapted.status.ack
    };
  } catch (err) {
    const summary =
      err instanceof Error ? err.message.slice(0, 500) : "unknown_error";
    await webhookEvent.update({
      processed: true,
      processingStatus: "error",
      errorSummary: summary
    });
    logger.error(
      {
        err,
        whatsappId: whatsapp.id,
        webhookEventId: webhookEvent.id
      },
      "[EvolutionWebhook] status update failed"
    );
    return {
      outcome: "error",
      reason: summary,
      webhookEventId: webhookEvent.id
    };
  }
}

/**
 * Processamento pós-auth do webhook Evolution.
 * Síncrono controlado (sem fila dedicada nesta fase) — documentado no relatório.
 */
export async function processEvolutionWebhook(input: {
  whatsapp: Whatsapp;
  body: Record<string, unknown>;
  apiKeyValid: boolean;
}): Promise<ProcessEvolutionWebhookResult> {
  const { whatsapp, body, apiKeyValid } = input;
  const envelope = body as EvolutionWebhookEnvelope;
  const eventType =
    envelope.event != null ? String(envelope.event).trim() : "unknown";
  const sanitized = sanitizeEvolutionWebhookPayload(body);

  if (!isEvolutionConnection(whatsapp)) {
    return { outcome: "error", reason: "not_evolution_connection" };
  }

  if (isEvolutionMessageUpdateEvent(eventType)) {
    return processEvolutionStatusUpdate({
      whatsapp,
      envelope,
      sanitized,
      apiKeyValid,
      eventType
    });
  }

  if (isEvolutionConnectionUpdateEvent(eventType)) {
    const life = await processEvolutionConnectionUpdate({
      whatsapp,
      envelope,
      sanitized,
      apiKeyValid,
      eventType
    });
    let outcome: ProcessEvolutionWebhookResult["outcome"] = "skipped";
    if (life.outcome === "processed") outcome = "processed";
    else if (life.outcome === "duplicate") outcome = "duplicate";
    else if (life.outcome === "skipped") outcome = "skipped";
    else outcome = "skipped";
    return {
      outcome,
      reason: life.reason,
      webhookEventId: life.webhookEventId
    };
  }

  if (isEvolutionQrcodeUpdatedEvent(eventType)) {
    const life = await processEvolutionQrcodeUpdated({
      whatsapp,
      envelope,
      sanitized,
      apiKeyValid,
      eventType
    });
    let outcome: ProcessEvolutionWebhookResult["outcome"] = "skipped";
    if (life.outcome === "processed") outcome = "processed";
    else if (life.outcome === "duplicate") outcome = "duplicate";
    else if (life.outcome === "skipped") outcome = "skipped";
    else outcome = "skipped";
    return {
      outcome,
      reason: life.reason,
      webhookEventId: life.webhookEventId
    };
  }

  if (!isEvolutionMessageUpsertEvent(eventType)) {
    const externalEventId = buildEvolutionExternalEventId({
      whatsappId: whatsapp.id,
      messageId: null,
      eventType,
      payloadHashSeed: JSON.stringify(sanitized).slice(0, 2000)
    });
    try {
      await EvolutionWebhookEvent.create({
        companyId: whatsapp.companyId,
        whatsappId: whatsapp.id,
        eventType,
        externalEventId,
        providerMessageId: null,
        processingStatus: "ignored",
        skipReason: "unsupported_event",
        apiKeyValid,
        processed: true,
        rawPayload: sanitized,
        receivedAt: new Date()
      });
    } catch (err) {
      if (!(err instanceof UniqueConstraintError)) {
        logger.warn(
          { err, eventType },
          "[EvolutionWebhook] ignore persist failed"
        );
      }
    }
    return { outcome: "ignored_event", reason: eventType };
  }

  const adapted = adaptEvolutionInboundMessage({
    envelope,
    companyId: whatsapp.companyId,
    whatsappId: whatsapp.id
  });

  let providerMessageId: string | null = null;
  if (adapted.ok) {
    providerMessageId = adapted.inbound.messageId;
  } else {
    const dataRec =
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? (envelope.data as { key?: { id?: unknown } })
        : null;
    const keyId = dataRec?.key?.id;
    if (typeof keyId === "string" && keyId.trim()) {
      providerMessageId = keyId.trim();
    }
  }

  const externalEventId = buildEvolutionExternalEventId({
    whatsappId: whatsapp.id,
    messageId: providerMessageId,
    eventType,
    payloadHashSeed: JSON.stringify(sanitized).slice(0, 2000)
  });

  let webhookEvent: EvolutionWebhookEvent;
  try {
    webhookEvent = await EvolutionWebhookEvent.create({
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      eventType,
      externalEventId,
      providerMessageId,
      processingStatus: "received",
      apiKeyValid,
      processed: false,
      rawPayload: sanitized,
      receivedAt: new Date()
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return {
        outcome: "duplicate",
        reason: "webhook_event_replay",
        messageId: providerMessageId || undefined
      };
    }
    throw err;
  }

  if (adapted.ok === false) {
    await webhookEvent.update({
      processed: true,
      processingStatus: "skipped",
      skipReason: adapted.reason,
      errorSummary: adapted.detail?.slice(0, 500) || null
    });
    return {
      outcome: "skipped",
      reason: adapted.reason,
      webhookEventId: webhookEvent.id,
      messageId: providerMessageId || undefined
    };
  }

  if ((adapted.inbound.body || "").length > MAX_BODY_CHARS) {
    await webhookEvent.update({
      processed: true,
      processingStatus: "skipped",
      skipReason: "body_too_large"
    });
    return {
      outcome: "skipped",
      reason: "body_too_large",
      webhookEventId: webhookEvent.id
    };
  }

  try {
    const result = await processEvolutionTextInbound({
      inbound: adapted.inbound,
      whatsapp,
      evolutionPayloadSanitized: sanitized,
      mediaHints: adapted.mediaHints
    });

    if (result.status === "duplicate") {
      await webhookEvent.update({
        processed: true,
        processingStatus: "duplicate",
        skipReason: "message_already_exists"
      });
      return {
        outcome: "duplicate",
        reason: "message_replay",
        messageId: result.messageId,
        webhookEventId: webhookEvent.id
      };
    }

    if (result.status === "skipped") {
      await webhookEvent.update({
        processed: true,
        processingStatus: "skipped",
        skipReason: result.reason
      });
      return {
        outcome: "skipped",
        reason: result.reason,
        webhookEventId: webhookEvent.id
      };
    }

    if (result.status === "media_failed") {
      // ACK 2xx + event marked error: evita retry infinito da Evolution.
      // Operador pode apagar o EvolutionWebhookEvent para reprocessar.
      await webhookEvent.update({
        processed: true,
        processingStatus: "error",
        skipReason: "media_download_failed",
        errorSummary: result.reason.slice(0, 500)
      });
      logger.warn(
        {
          whatsappId: whatsapp.id,
          messageId: adapted.inbound.messageId,
          messageType: adapted.inbound.messageType,
          reason: result.reason
        },
        "[EvolutionWebhook] media failed (acked)"
      );
      return {
        outcome: "error",
        reason: result.reason,
        messageId: adapted.inbound.messageId,
        webhookEventId: webhookEvent.id
      };
    }

    await webhookEvent.update({
      processed: true,
      processingStatus: "processed"
    });

    logger.info(
      {
        whatsappId: whatsapp.id,
        companyId: whatsapp.companyId,
        messageId: result.messageId,
        ticketId: result.ticketId,
        eventType,
        hasMedia: adapted.inbound.media.hasMedia
      },
      "[EvolutionWebhook] inbound processed"
    );

    return {
      outcome: "processed",
      messageId: result.messageId,
      ticketId: result.ticketId,
      webhookEventId: webhookEvent.id
    };
  } catch (err) {
    const summary =
      err instanceof Error ? err.message.slice(0, 500) : "unknown_error";
    await webhookEvent.update({
      processed: true,
      processingStatus: "error",
      errorSummary: summary
    });
    logger.error(
      {
        err,
        whatsappId: whatsapp.id,
        webhookEventId: webhookEvent.id
      },
      "[EvolutionWebhook] processing failed"
    );
    return {
      outcome: "error",
      reason: summary,
      webhookEventId: webhookEvent.id
    };
  }
}
