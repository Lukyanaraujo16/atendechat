import axios, { AxiosInstance } from "axios";
import WhatsappEvolutionCredential from "../../../../../models/WhatsappEvolutionCredential";
import { decryptEvolutionApiKey } from "../../../../../helpers/evolutionCredentialCrypto";
import { logger } from "../../../../../utils/logger";
import { EVOLUTION_MEDIA_LIMITS } from "./evolutionMediaLimits";
import { assertSafeEvolutionMediaUrlResolved } from "./evolutionUrlSafety";

export class EvolutionHttpError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EvolutionHttpError";
    this.code = code;
  }
}

export type EvolutionGetBase64Result = {
  base64: string;
  mimetype?: string | null;
};

function createAxiosClient(baseUrl: string, apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs,
    maxRedirects: 0,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    validateStatus: () => true
  });
}

/**
 * Client HTTP Evolution (Fases 7–8).
 * API key descriptografada só em memória; nunca logada.
 * Sem retry automático em POST de envio (não idempotente).
 */
export async function loadEvolutionCredentialForMedia(
  whatsappId: number
): Promise<{
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}> {
  const cred = await WhatsappEvolutionCredential.unscoped().findOne({
    where: { whatsappId },
    attributes: ["baseUrl", "instanceName", "apiKeyEncrypted"]
  });
  if (!cred?.baseUrl || !cred.instanceName || !cred.apiKeyEncrypted) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_CREDENTIAL_MISSING",
      "Credencial Evolution ausente"
    );
  }
  let apiKey: string;
  try {
    apiKey = decryptEvolutionApiKey(cred.apiKeyEncrypted);
  } catch {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_CREDENTIAL_DECRYPT",
      "Falha ao descriptografar API key Evolution"
    );
  }
  return {
    baseUrl: cred.baseUrl.replace(/\/+$/, ""),
    instanceName: cred.instanceName,
    apiKey
  };
}

/** Alias Fase 8 — mesma credencial para inbound/outbound. */
export const loadEvolutionCredential = loadEvolutionCredentialForMedia;

function parseEvolutionErrorBody(data: unknown): string {
  if (!data || typeof data !== "object") return "Evolution API error";
  const d = data as Record<string, unknown>;
  if (typeof d.message === "string") return d.message.slice(0, 300);
  if (Array.isArray(d.message)) return String(d.message[0] || "").slice(0, 300);
  if (d.response && typeof d.response === "object") {
    const r = d.response as Record<string, unknown>;
    if (Array.isArray(r.message))
      return String(r.message[0] || "").slice(0, 300);
  }
  if (typeof d.error === "string") return d.error.slice(0, 300);
  return "Evolution API error";
}

async function evolutionRequestJson(input: {
  whatsappId: number;
  method: "post" | "delete";
  path: string;
  body: Record<string, unknown>;
}): Promise<unknown> {
  const cred = await loadEvolutionCredential(input.whatsappId);
  const client = createAxiosClient(cred.baseUrl, cred.apiKey);
  const path = input.path.replace(
    "{instance}",
    encodeURIComponent(cred.instanceName)
  );

  let response;
  try {
    response =
      input.method === "delete"
        ? await client.delete(path, { data: input.body })
        : await client.post(path, input.body);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    logger.warn(
      { whatsappId: input.whatsappId, path, code, method: input.method },
      "[EvolutionHttp] outbound request failed"
    );
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      throw new EvolutionHttpError(
        "ERR_EVOLUTION_TIMEOUT",
        "Timeout ao chamar Evolution API"
      );
    }
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_REQUEST_FAILED",
      "Falha de rede ao chamar Evolution API"
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_API_ERROR",
      parseEvolutionErrorBody(response.data) ||
        `Evolution HTTP ${response.status}`
    );
  }

  return response.data;
}

async function evolutionPostJson(input: {
  whatsappId: number;
  path: string;
  body: Record<string, unknown>;
}): Promise<unknown> {
  return evolutionRequestJson({
    whatsappId: input.whatsappId,
    method: "post",
    path: input.path,
    body: input.body
  });
}

export type EvolutionQuotedPayload = {
  key: {
    id: string;
    remoteJid?: string;
    fromMe?: boolean;
    participant?: string;
  };
  message?: { conversation?: string };
};

/**
 * POST /message/sendText/{instance}
 * Docs: https://doc.evolution-api.com/v2/api-reference/message-controller/send-text
 * Quoted: body.quoted = { key: { id, ... }, message? }
 */
export async function evolutionSendText(input: {
  whatsappId: number;
  number: string;
  text: string;
  quoted?: EvolutionQuotedPayload;
}): Promise<unknown> {
  const body: Record<string, unknown> = {
    number: input.number,
    text: input.text
  };
  if (input.quoted) {
    body.quoted = input.quoted;
  }
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/message/sendText/{instance}",
    body
  });
}

/**
 * POST /message/sendMedia/{instance}
 * mediatype: image | video | document | audio
 * Quoted: mesmo mecanismo que sendText (quoted no body).
 */
export async function evolutionSendMedia(input: {
  whatsappId: number;
  number: string;
  mediatype: "image" | "video" | "document" | "audio";
  media: string;
  mimetype: string;
  fileName: string;
  caption?: string;
  quoted?: EvolutionQuotedPayload;
}): Promise<unknown> {
  const body: Record<string, unknown> = {
    number: input.number,
    mediatype: input.mediatype,
    media: input.media,
    mimetype: input.mimetype,
    fileName: input.fileName,
    caption: input.caption != null ? input.caption : ""
  };
  if (input.quoted) {
    body.quoted = input.quoted;
  }
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/message/sendMedia/{instance}",
    body
  });
}

/**
 * POST /message/sendWhatsAppAudio/{instance} — voice note / PTT
 */
export async function evolutionSendWhatsAppAudio(input: {
  whatsappId: number;
  number: string;
  audio: string;
}): Promise<unknown> {
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/message/sendWhatsAppAudio/{instance}",
    body: {
      number: input.number,
      audio: input.audio
    }
  });
}

/**
 * POST /message/sendSticker/{instance}
 */
export async function evolutionSendSticker(input: {
  whatsappId: number;
  number: string;
  sticker: string;
}): Promise<unknown> {
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/message/sendSticker/{instance}",
    body: {
      number: input.number,
      sticker: input.sticker
    }
  });
}

/**
 * DELETE /chat/deleteMessageForEveryone/{instance}
 * Body: { id, remoteJid, fromMe, participant? }
 * Sem retry automático.
 */
export async function evolutionDeleteMessage(input: {
  whatsappId: number;
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}): Promise<unknown> {
  const body: Record<string, unknown> = {
    id: input.id,
    remoteJid: input.remoteJid,
    fromMe: input.fromMe
  };
  if (input.participant) {
    body.participant = input.participant;
  }
  return evolutionRequestJson({
    whatsappId: input.whatsappId,
    method: "delete",
    path: "/chat/deleteMessageForEveryone/{instance}",
    body
  });
}

/**
 * POST /chat/markMessageAsRead/{instance}
 * Docs: https://doc.evolution-api.com/v2/api-reference/chat-controller/mark-as-read
 * Body: { readMessages: [{ remoteJid, fromMe, id }] }
 * Sem retry automático (efeito peer-visível).
 */
export async function evolutionMarkMessageAsRead(input: {
  whatsappId: number;
  readMessages: Array<{
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  }>;
}): Promise<unknown> {
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/chat/markMessageAsRead/{instance}",
    body: {
      readMessages: input.readMessages
    }
  });
}

/**
 * POST /chat/sendPresence/{instance}
 * Schema Evolution: number, presence, delay (raiz — issue #1107).
 * presence: unavailable | available | composing | recording | paused
 */
export async function evolutionSendPresence(input: {
  whatsappId: number;
  number: string;
  presence: "unavailable" | "available" | "composing" | "recording" | "paused";
  delay: number;
}): Promise<unknown> {
  return evolutionPostJson({
    whatsappId: input.whatsappId,
    path: "/chat/sendPresence/{instance}",
    body: {
      number: input.number,
      presence: input.presence,
      delay: input.delay
    }
  });
}

/**
 * POST /chat/getBase64FromMediaMessage/{instance}
 * Docs: https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
 */
export async function evolutionGetBase64FromMediaMessage(input: {
  whatsappId: number;
  messageId: string;
  convertToMp4?: boolean;
}): Promise<EvolutionGetBase64Result> {
  const cred = await loadEvolutionCredentialForMedia(input.whatsappId);
  const client = createAxiosClient(cred.baseUrl, cred.apiKey);

  const path = `/chat/getBase64FromMediaMessage/${encodeURIComponent(
    cred.instanceName
  )}`;

  let response;
  try {
    response = await client.post(path, {
      message: { key: { id: input.messageId } },
      convertToMp4: Boolean(input.convertToMp4)
    });
  } catch (err) {
    logger.warn(
      {
        whatsappId: input.whatsappId,
        messageId: input.messageId,
        code: (err as { code?: string })?.code
      },
      "[EvolutionHttp] getBase64 request failed"
    );
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TIMEOUT",
      "Timeout/erro de rede ao obter mídia Evolution"
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_HTTP",
      `Evolution getBase64 HTTP ${response.status}`
    );
  }

  const { data } = response;
  let base64: string | null = null;
  if (typeof data === "string") {
    base64 = data;
  } else if (data && typeof data === "object") {
    if (typeof data.base64 === "string") base64 = data.base64;
    else if (data.data && typeof data.data.base64 === "string") {
      base64 = data.data.base64;
    }
  }

  if (!base64 || !String(base64).trim()) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_EMPTY",
      "Evolution getBase64 retornou vazio"
    );
  }

  let mimetype: string | null = null;
  if (data && typeof data === "object") {
    if (typeof data.mimetype === "string") mimetype = data.mimetype;
    else if (typeof data.mimeType === "string") mimetype = data.mimeType;
  }

  return { base64: String(base64).trim(), mimetype };
}

/**
 * Download binário de URL somente se host == baseUrl Evolution (SSRF-safe).
 */
export async function evolutionDownloadMediaFromUrl(input: {
  whatsappId: number;
  mediaUrl: string;
  maxBytes: number;
}): Promise<Buffer> {
  const cred = await loadEvolutionCredentialForMedia(input.whatsappId);
  const safe = await assertSafeEvolutionMediaUrlResolved({
    candidateUrl: input.mediaUrl,
    allowedBaseUrl: cred.baseUrl
  });
  if (safe.ok === false) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
      `URL de mídia bloqueada: ${safe.reason}`
    );
  }

  let response;
  try {
    response = await axios.get(safe.url.toString(), {
      responseType: "arraybuffer",
      timeout: EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs,
      maxRedirects: 0,
      maxContentLength: input.maxBytes,
      maxBodyLength: input.maxBytes,
      headers: { apikey: cred.apiKey },
      validateStatus: () => true
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      throw new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_TIMEOUT",
        "Timeout ao baixar URL de mídia Evolution"
      );
    }
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_DOWNLOAD",
      "Falha ao baixar URL de mídia Evolution"
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_HTTP",
      `Download mídia HTTP ${response.status}`
    );
  }

  const buf = Buffer.from(response.data);
  if (buf.length > input.maxBytes) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TOO_LARGE",
      "Arquivo Evolution excede limite"
    );
  }
  return buf;
}
