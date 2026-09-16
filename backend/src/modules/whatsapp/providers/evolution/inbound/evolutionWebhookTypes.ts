/**
 * Contrato Evolution webhook (Fases 6–7) — Evolution API v2.
 * Docs: webhooks + getBase64FromMediaMessage
 * https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
 *
 * Mídia no webhook pode vir como:
 * - base64 inline (webhookBase64=true): imageMessage.base64 / mediaBase64
 * - URL (url/mediaUrl) na própria Evolution
 * - apenas key → POST /chat/getBase64FromMediaMessage/{instance}
 *
 * Shape de message.* alinhado a campos Baileys-compatíveis que a Evolution
 * espelha no upsert (mimetype, caption, fileName, ptt, degreesLatitude, vcard…).
 */

export const EVOLUTION_MESSAGE_UPSERT_EVENTS = [
  "MESSAGES_UPSERT",
  "messages.upsert"
] as const;

export type EvolutionMessageUpsertEvent =
  (typeof EVOLUTION_MESSAGE_UPSERT_EVENTS)[number];

/**
 * Status/ACK — Evolution API v2 webhook MESSAGES_UPDATE.
 * Docs: https://doc.evolution-api.com/v2/en/configuration/webhooks
 * Payload real (Evolution baileys channel): keyId, remoteJid, fromMe, status…
 */
export const EVOLUTION_MESSAGE_UPDATE_EVENTS = [
  "MESSAGES_UPDATE",
  "messages.update"
] as const;

export type EvolutionMessageUpdateEvent =
  (typeof EVOLUTION_MESSAGE_UPDATE_EVENTS)[number];

export const EVOLUTION_MESSAGE_DELETE_EVENTS = [
  "MESSAGES_DELETE",
  "messages.delete"
] as const;

export type EvolutionMessageDeleteEvent =
  (typeof EVOLUTION_MESSAGE_DELETE_EVENTS)[number];

/** CONNECTION_UPDATE — lifecycle (Fase 10). */
export const EVOLUTION_CONNECTION_UPDATE_EVENTS = [
  "CONNECTION_UPDATE",
  "connection.update"
] as const;

export type EvolutionConnectionUpdateEvent =
  (typeof EVOLUTION_CONNECTION_UPDATE_EVENTS)[number];

/** QRCODE_UPDATED — lifecycle (Fase 10). */
export const EVOLUTION_QRCODE_UPDATED_EVENTS = [
  "QRCODE_UPDATED",
  "qrcode.updated"
] as const;

export type EvolutionQrcodeUpdatedEvent =
  (typeof EVOLUTION_QRCODE_UPDATED_EVENTS)[number];

/** PRESENCE_UPDATE — typing/recording inbound (12.1-C2b.1). */
export const EVOLUTION_PRESENCE_UPDATE_EVENTS = [
  "PRESENCE_UPDATE",
  "presence.update"
] as const;

export type EvolutionPresenceUpdateEvent =
  (typeof EVOLUTION_PRESENCE_UPDATE_EVENTS)[number];

export type EvolutionPresenceEntry = {
  lastKnownPresence?: string;
  lastSeen?: number;
};

export type EvolutionPresenceUpdateData = {
  id?: string;
  presences?: Record<string, EvolutionPresenceEntry | undefined>;
};

export type EvolutionWebhookKey = {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
  participant?: string;
  senderPn?: string;
  remoteJidAlt?: string;
  participantPn?: string;
};

export type EvolutionMediaContextInfo = {
  stanzaId?: string;
  participant?: string;
  quotedMessage?: unknown;
};

export type EvolutionImageMessage = {
  mimetype?: string;
  caption?: string;
  fileLength?: number | string;
  url?: string;
  mediaUrl?: string;
  base64?: string;
  mediaBase64?: string;
  jpegThumbnail?: string;
  contextInfo?: EvolutionMediaContextInfo;
};

export type EvolutionVideoMessage = {
  mimetype?: string;
  caption?: string;
  fileLength?: number | string;
  fileName?: string;
  url?: string;
  mediaUrl?: string;
  base64?: string;
  mediaBase64?: string;
  contextInfo?: EvolutionMediaContextInfo;
};

export type EvolutionAudioMessage = {
  mimetype?: string;
  ptt?: boolean;
  seconds?: number;
  fileLength?: number | string;
  url?: string;
  mediaUrl?: string;
  base64?: string;
  mediaBase64?: string;
  contextInfo?: EvolutionMediaContextInfo;
};

export type EvolutionDocumentMessage = {
  mimetype?: string;
  caption?: string;
  fileName?: string;
  title?: string;
  fileLength?: number | string;
  url?: string;
  mediaUrl?: string;
  base64?: string;
  mediaBase64?: string;
  contextInfo?: EvolutionMediaContextInfo;
};

export type EvolutionStickerMessage = {
  mimetype?: string;
  fileLength?: number | string;
  url?: string;
  mediaUrl?: string;
  base64?: string;
  mediaBase64?: string;
  isAnimated?: boolean;
  contextInfo?: EvolutionMediaContextInfo;
};

export type EvolutionLocationMessage = {
  degreesLatitude?: number;
  degreesLongitude?: number;
  name?: string;
  address?: string;
  url?: string;
  jpegThumbnail?: string;
};

export type EvolutionContactMessage = {
  displayName?: string;
  vcard?: string;
};

export type EvolutionReactionMessage = {
  text?: string;
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
    participant?: string;
  };
};

export type EvolutionWebhookMessageContent = {
  conversation?: string;
  contextInfo?: EvolutionMediaContextInfo;
  extendedTextMessage?: {
    text?: string;
    contextInfo?: EvolutionMediaContextInfo;
  };
  imageMessage?: EvolutionImageMessage;
  videoMessage?: EvolutionVideoMessage;
  audioMessage?: EvolutionAudioMessage;
  documentMessage?: EvolutionDocumentMessage;
  documentWithCaptionMessage?: {
    message?: { documentMessage?: EvolutionDocumentMessage };
  };
  stickerMessage?: EvolutionStickerMessage;
  reactionMessage?: EvolutionReactionMessage;
  contactMessage?: EvolutionContactMessage;
  contactsArrayMessage?: {
    contacts?: EvolutionContactMessage[];
    displayName?: string;
  };
  locationMessage?: EvolutionLocationMessage;
  liveLocationMessage?: EvolutionLocationMessage;
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
  /** Evolution prepareMessage copia contextInfo para a raiz de data. */
  contextInfo?: EvolutionMediaContextInfo;
  [key: string]: unknown;
};

export type EvolutionWebhookEnvelope = {
  event?: string;
  instance?: string;
  data?:
    | EvolutionWebhookMessageData
    | EvolutionWebhookMessageData[]
    | EvolutionPresenceUpdateData;
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

export function isEvolutionMessageUpdateEvent(
  event: string | null | undefined
): event is EvolutionMessageUpdateEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_MESSAGE_UPDATE_EVENTS as readonly string[]).includes(
    normalized
  );
}

export function isEvolutionMessageDeleteEvent(
  event: string | null | undefined
): event is EvolutionMessageDeleteEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_MESSAGE_DELETE_EVENTS as readonly string[]).includes(
    normalized
  );
}

export function isEvolutionConnectionUpdateEvent(
  event: string | null | undefined
): event is EvolutionConnectionUpdateEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_CONNECTION_UPDATE_EVENTS as readonly string[]).includes(
    normalized
  );
}

export function isEvolutionQrcodeUpdatedEvent(
  event: string | null | undefined
): event is EvolutionQrcodeUpdatedEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_QRCODE_UPDATED_EVENTS as readonly string[]).includes(
    normalized
  );
}

export function isEvolutionPresenceUpdateEvent(
  event: string | null | undefined
): event is EvolutionPresenceUpdateEvent {
  if (!event) return false;
  const normalized = String(event).trim();
  return (EVOLUTION_PRESENCE_UPDATE_EVENTS as readonly string[]).includes(
    normalized
  );
}
const BASE64_KEYS = new Set([
  "base64",
  "mediaBase64",
  "fileBase64",
  "jpegThumbnail"
]);

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth <= 0) return null;
  if (Array.isArray(value)) {
    return value.map(v => sanitizeValue(v, depth - 1));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (out, [k, v]) => {
        if (BASE64_KEYS.has(k)) {
          out[k] = typeof v === "string" && v.length > 0 ? "[omitted]" : null;
          return out;
        }
        if (
          (k === "url" || k === "mediaUrl") &&
          typeof v === "string" &&
          v.startsWith("data:")
        ) {
          out[k] = "[omitted-data-url]";
          return out;
        }
        out[k] = sanitizeValue(v, depth - 1);
        return out;
      },
      {} as Record<string, unknown>
    );
  }
  return value;
}

/**
 * Remove apikey e base64/thumbnails grandes do payload persistido.
 */
export function sanitizeEvolutionWebhookPayload(
  body: Record<string, unknown>
): Record<string, unknown> {
  const clone = sanitizeValue({ ...body }, 8) as Record<string, unknown>;
  delete clone.apikey;
  delete clone.apiKey;
  delete clone.api_key;
  return clone;
}
