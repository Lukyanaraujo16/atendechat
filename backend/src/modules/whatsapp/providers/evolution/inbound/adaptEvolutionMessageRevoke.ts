import {
  EvolutionWebhookEnvelope,
  isEvolutionMessageDeleteEvent
} from "./evolutionWebhookTypes";

export type NormalizedWhatsAppRevoke = {
  provider: "evolution";
  companyId: number;
  whatsappId: number;
  messageId: string;
  remoteJid: string | null;
  fromMe: boolean | null;
  participant: string | null;
};

export type AdaptEvolutionRevokeResult =
  | { ok: true; revoke: NormalizedWhatsAppRevoke }
  | {
      ok: false;
      reason: "unsupported_event" | "invalid_payload" | "missing_message_id";
      detail?: string;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extrai data de MESSAGES_DELETE.
 * Fontes comprovadas Evolution API v2.3.7 (whatsapp.baileys.service.ts):
 * 1) inbound WhatsApp: `{ ...key, status: 'DELETED' }` → id/remoteJid/fromMe no topo
 * 2) delete via API Evolution: `{ id: prismaId, key: { id, remoteJid, ... }, status: 'DELETED' }`
 * Nunca usar `id` interno Prisma quando `key.id` existir.
 * Nunca ler `data.message` (conteúdo).
 */
export function pickEvolutionRevokeData(
  envelope: EvolutionWebhookEnvelope
): Record<string, unknown> | null {
  const { data } = envelope;
  if (Array.isArray(data)) {
    const first = data.find(item => item && typeof item === "object");
    return first ? asRecord(first) : null;
  }
  return asRecord(data);
}

function pickTrimmedString(primary: unknown, fallback: unknown): string | null {
  if (primary != null && String(primary).trim()) {
    return String(primary).trim();
  }
  if (fallback != null && String(fallback).trim()) {
    return String(fallback).trim();
  }
  return null;
}

function pickBoolean(primary: unknown, fallback: unknown): boolean | null {
  if (typeof primary === "boolean") return primary;
  if (typeof fallback === "boolean") return fallback;
  return null;
}

function extractRevokeMessageId(data: Record<string, unknown>): string | null {
  const key = asRecord(data.key);
  if (key && key.id != null && String(key.id).trim()) {
    return String(key.id).trim();
  }
  if (typeof data.id === "string" && data.id.trim()) {
    return data.id.trim();
  }
  if (typeof data.keyId === "string" && data.keyId.trim()) {
    return data.keyId.trim();
  }
  return null;
}

export function adaptEvolutionMessageRevoke(input: {
  envelope: EvolutionWebhookEnvelope;
  companyId: number;
  whatsappId: number;
}): AdaptEvolutionRevokeResult {
  const event =
    input.envelope.event != null ? String(input.envelope.event).trim() : "";
  if (!isEvolutionMessageDeleteEvent(event)) {
    return {
      ok: false,
      reason: "unsupported_event",
      detail: event || "empty"
    };
  }

  const data = pickEvolutionRevokeData(input.envelope);
  if (!data) {
    return { ok: false, reason: "invalid_payload", detail: "missing_data" };
  }

  const messageId = extractRevokeMessageId(data);
  if (!messageId) {
    return { ok: false, reason: "missing_message_id" };
  }

  const key = asRecord(data.key);
  const remoteJid = pickTrimmedString(data.remoteJid, key?.remoteJid);
  const fromMe = pickBoolean(data.fromMe, key?.fromMe);
  const participant = pickTrimmedString(data.participant, key?.participant);

  return {
    ok: true,
    revoke: {
      provider: "evolution",
      companyId: input.companyId,
      whatsappId: input.whatsappId,
      messageId,
      remoteJid,
      fromMe,
      participant
    }
  };
}

export function omitRevokeMessageContent(
  sanitized: Record<string, unknown>
): Record<string, unknown> {
  const clone = { ...sanitized };
  const { data } = clone;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const next = { ...(data as Record<string, unknown>) };
    delete next.message;
    clone.data = next;
  }
  return clone;
}

export function buildEvolutionRevokeExternalEventId(input: {
  whatsappId: number;
  messageId: string;
}): string {
  return `evo:${input.whatsappId}:${input.messageId}:revoke`;
}
