import { UniqueConstraintError } from "sequelize";
import Whatsapp from "../../../../../models/Whatsapp";
import EvolutionWebhookEvent from "../../../../../models/EvolutionWebhookEvent";
import { logger } from "../../../../../utils/logger";
import { buildEvolutionExternalEventId } from "../inbound/adaptEvolutionInboundMessage";
import { EvolutionWebhookEnvelope } from "../inbound/evolutionWebhookTypes";
import { applyEvolutionSessionStatus } from "./applyEvolutionSessionStatus";
import {
  extractEvolutionQrcodeRaw,
  extractEvolutionStateFromPayload,
  mapEvolutionStateToStreamHubStatus
} from "./mapEvolutionConnectionState";

export type ProcessEvolutionLifecycleResult = {
  outcome: "processed" | "duplicate" | "skipped" | "noop";
  reason?: string;
  status?: string;
  webhookEventId?: number;
};

export async function processEvolutionConnectionUpdate(input: {
  whatsapp: Whatsapp;
  envelope: EvolutionWebhookEnvelope;
  sanitized: Record<string, unknown>;
  apiKeyValid: boolean;
  eventType: string;
}): Promise<ProcessEvolutionLifecycleResult> {
  const { whatsapp, envelope, sanitized, apiKeyValid, eventType } = input;
  const state = extractEvolutionStateFromPayload(envelope.data || envelope);
  const nextStatus = mapEvolutionStateToStreamHubStatus(state, {
    hasQrcode: false
  });

  const externalEventId = buildEvolutionExternalEventId({
    whatsappId: whatsapp.id,
    messageId: null,
    eventType,
    payloadHashSeed: `${state}:${JSON.stringify(sanitized).slice(0, 500)}`
  });

  let webhookEvent: EvolutionWebhookEvent;
  try {
    webhookEvent = await EvolutionWebhookEvent.create({
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      eventType,
      externalEventId,
      providerMessageId: null,
      processingStatus: "received",
      apiKeyValid,
      processed: false,
      rawPayload: sanitized,
      receivedAt: new Date()
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return { outcome: "duplicate", reason: "webhook_event_replay" };
    }
    throw err;
  }

  const applied = await applyEvolutionSessionStatus({
    whatsapp,
    status: nextStatus,
    qrcode: nextStatus === "CONNECTED" ? "" : undefined,
    force: nextStatus === "CONNECTED" || nextStatus === "DISCONNECTED"
  });

  await webhookEvent.update({
    processed: true,
    processingStatus: applied.applied ? "processed" : "duplicate",
    skipReason: applied.applied ? null : applied.reason
  });

  logger.info(
    {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId,
      eventType,
      evolutionState: state,
      status: applied.status,
      applied: applied.applied
    },
    "[EvolutionLifecycle] CONNECTION_UPDATE"
  );

  return {
    outcome: applied.applied ? "processed" : "noop",
    reason: applied.applied ? undefined : applied.reason,
    status: applied.status,
    webhookEventId: webhookEvent.id
  };
}

export async function processEvolutionQrcodeUpdated(input: {
  whatsapp: Whatsapp;
  envelope: EvolutionWebhookEnvelope;
  sanitized: Record<string, unknown>;
  apiKeyValid: boolean;
  eventType: string;
}): Promise<ProcessEvolutionLifecycleResult> {
  const { whatsapp, envelope, sanitized, apiKeyValid, eventType } = input;

  if (String(whatsapp.status || "") === "CONNECTED") {
    // QR tardio após CONNECTED — não regride.
    return { outcome: "skipped", reason: "already_connected" };
  }

  const qrRaw = extractEvolutionQrcodeRaw(envelope.data || envelope);
  if (!qrRaw) {
    return { outcome: "skipped", reason: "qrcode_missing_code" };
  }

  const externalEventId = buildEvolutionExternalEventId({
    whatsappId: whatsapp.id,
    messageId: null,
    eventType,
    payloadHashSeed: qrRaw.slice(0, 120)
  });

  let webhookEvent: EvolutionWebhookEvent;
  try {
    webhookEvent = await EvolutionWebhookEvent.create({
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      eventType,
      externalEventId,
      providerMessageId: null,
      processingStatus: "received",
      apiKeyValid,
      processed: false,
      rawPayload: sanitized,
      receivedAt: new Date()
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return { outcome: "duplicate", reason: "webhook_event_replay" };
    }
    throw err;
  }

  const applied = await applyEvolutionSessionStatus({
    whatsapp,
    status: "qrcode",
    qrcode: qrRaw,
    force: true
  });

  await webhookEvent.update({
    processed: true,
    processingStatus: "processed"
  });

  logger.info(
    {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId,
      eventType,
      hasQrcode: true
    },
    "[EvolutionLifecycle] QRCODE_UPDATED"
  );

  return {
    outcome: applied.applied ? "processed" : "noop",
    status: "qrcode",
    webhookEventId: webhookEvent.id
  };
}
