/**
 * Contrato Evolution webhook (Fase 6) — baseado na documentação Evolution API v2:
 * https://doc.evolution-api.com / mintlify concepts/webhooks
 *
 * Eventos aceitos:
 * - "MESSAGES_UPSERT"
 * - "messages.upsert"
 *
 * Auth: header/body `apikey` (sem HMAC nativo no modo alvo).
 * Não inventar campos fora deste shape documentado + extensões LID comuns.
 */

export const EVOLUTION_MESSAGE_UPSERT_EVENTS = [
  "MESSAGES_UPSERT",
  "messages.upsert"
] as const;

export type EvolutionMessageUpsertEvent =
  (typeof EVOLUTION_MESSAGE_UPSERT_EVENTS)[number];

export type EvolutionWebhookKey = {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
  participant?: string;
  /** Extensões LID/PN quando Evolution as enviar */
  senderPn?: string;
  remoteJidAlt?: string;
  participantPn?: string;
};

export type EvolutionWebhookMessageContent = {
  conversation?: string;
  extendedTextMessage?: {
    text?: string;
    contextInfo?: {
      stanzaId?: string;
      participant?: string;
      quotedMessage?: unknown;
    };
  };
  imageMessage?: unknown;
  videoMessage?: unknown;
  audioMessage?: unknown;
  documentMessage?: unknown;
  stickerMessage?: unknown;
  reactionMessage?: unknown;
  contactMessage?: unknown;
  locationMessage?: unknown;
  [key: string]: unknown;
};

export type EvolutionWebhookMessageData = {
  key?: EvolutionWebhookKey;
  pushName?: string;
  message?: EvolutionWebhookMessageContent | null;
  messageType?: string;
  messageTimestamp?: number | string;
  instanceId?: string;
  source?: string;
  [key: string]: unknown;
};

export type EvolutionWebhookEnvelope = {
  event?: string;
  instance?: string;
  data?: EvolutionWebhookMessageData | EvolutionWebhookMessageData[];
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  /** Evolution pode incluir apikey no body — NUNCA logar/persistir. */
  apikey?: string;
  [key: string]: unknown;
};

export function isEvolutionMessageUpsertEvent(
  event: string | null | undefined
): event is EvolutionMessageUpsertEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_MESSAGE_UPSERT_EVENTS as readonly string[]).includes(
    normalized
  );
}

export function sanitizeEvolutionWebhookPayload(
  body: Record<string, unknown>
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...body };
  delete clone.apikey;
  delete clone.apiKey;
  delete clone.api_key;
  return clone;
}
