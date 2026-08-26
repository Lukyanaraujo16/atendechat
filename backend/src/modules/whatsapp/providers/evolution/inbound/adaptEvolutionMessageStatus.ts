import { NormalizedWhatsAppMessageStatus } from "../../../inbound/NormalizedWhatsAppMessageStatus";
import {
  EvolutionWebhookEnvelope,
  isEvolutionMessageUpdateEvent
} from "./evolutionWebhookTypes";
import { mapEvolutionStatusToAck } from "./mapEvolutionStatusToAck";

export type AdaptEvolutionStatusResult =
  | { ok: true; status: NormalizedWhatsAppMessageStatus }
  | {
      ok: false;
      reason:
        | "unsupported_event"
        | "invalid_payload"
        | "missing_message_id"
        | "unmapped_status";
      detail?: string;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extrai item de status do envelope MESSAGES_UPDATE.
 * Shape real Evolution (whatsapp.baileys.service):
 * { keyId, remoteJid, fromMe, participant, status, instanceId, … }
 * Também aceita data.key.id + data.status (variantes).
 */
export function pickEvolutionStatusData(
  envelope: EvolutionWebhookEnvelope
): Record<string, unknown> | null {
  const { data } = envelope;
  if (Array.isArray(data)) {
    const first = data.find(item => item && typeof item === "object");
    return first ? asRecord(first) : null;
  }
  return asRecord(data);
}

function extractMessageId(data: Record<string, unknown>): string | null {
  if (typeof data.keyId === "string" && data.keyId.trim()) {
    return data.keyId.trim();
  }
  const key = asRecord(data.key);
  if (key && key.id != null && String(key.id).trim()) {
    return String(key.id).trim();
  }
  // messageId na Evolution UPDATE = id interno Prisma — NÃO usar como WA id
  return null;
}

function extractTimestamp(data: Record<string, unknown>): Date | null {
  let raw: unknown = null;
  if (data.messageTimestamp != null) {
    raw = data.messageTimestamp;
  } else if (data.datetime != null) {
    raw = data.datetime;
  }
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const ms = n < 1e12 ? n * 1000 : n;
      return new Date(ms);
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Adapta webhook Evolution MESSAGES_UPDATE → NormalizedWhatsAppMessageStatus.
 */
export function adaptEvolutionMessageStatus(input: {
  envelope: EvolutionWebhookEnvelope;
  companyId: number;
  whatsappId: number;
}): AdaptEvolutionStatusResult {
  const event =
    input.envelope.event != null ? String(input.envelope.event).trim() : "";
  if (!isEvolutionMessageUpdateEvent(event)) {
    return {
      ok: false,
      reason: "unsupported_event",
      detail: event || "empty"
    };
  }

  const data = pickEvolutionStatusData(input.envelope);
  if (!data) {
    return { ok: false, reason: "invalid_payload", detail: "missing_data" };
  }

  const messageId = extractMessageId(data);
  if (!messageId) {
    return { ok: false, reason: "missing_message_id" };
  }

  let providerStatus: string | number | null = null;
  if (data.status != null) {
    providerStatus = data.status as string | number;
  } else if (data.ack != null) {
    providerStatus = data.ack as string | number;
  }

  const ack = mapEvolutionStatusToAck(providerStatus);
  if (ack == null) {
    return {
      ok: false,
      reason: "unmapped_status",
      detail:
        providerStatus != null ? String(providerStatus).slice(0, 64) : "null"
    };
  }

  const remoteJid =
    data.remoteJid != null && String(data.remoteJid).trim()
      ? String(data.remoteJid).trim()
      : (() => {
          const key = asRecord(data.key);
          return key?.remoteJid != null && String(key.remoteJid).trim()
            ? String(key.remoteJid).trim()
            : null;
        })();

  const fromMe =
    typeof data.fromMe === "boolean"
      ? data.fromMe
      : (() => {
          const key = asRecord(data.key);
          return typeof key?.fromMe === "boolean" ? key.fromMe : null;
        })();

  const participant =
    data.participant != null && String(data.participant).trim()
      ? String(data.participant).trim()
      : null;

  const status: NormalizedWhatsAppMessageStatus = {
    provider: "evolution",
    companyId: input.companyId,
    whatsappId: input.whatsappId,
    messageId,
    ack,
    fromMe,
    remoteJid,
    participant,
    timestamp: extractTimestamp(data),
    providerStatus
  };

  return { ok: true, status };
}

/** externalEventId exclusivo para ACK — não colide com UPSERT `evo:wid:msgId`. */
export function buildEvolutionAckExternalEventId(input: {
  whatsappId: number;
  messageId: string;
  ack: number;
  providerStatus: string | number | null;
}): string {
  const statusPart =
    input.providerStatus != null
      ? String(input.providerStatus).trim().toUpperCase().slice(0, 32)
      : String(input.ack);
  return `evo:${input.whatsappId}:${input.messageId}:ack:${statusPart}`;
}
