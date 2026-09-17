import AppError from "../../../../../errors/AppError";
import {
  WhatsAppOutbound,
  WhatsAppOutboundSendResult,
  WhatsAppPresence,
  WhatsAppQuotedMessage,
  WhatsAppReadKey,
  WhatsAppDeleteTarget
} from "../../../outbound/WhatsAppOutbound";
import {
  EvolutionHttpError,
  EvolutionQuotedPayload,
  evolutionDeleteMessage,
  evolutionMarkMessageAsRead,
  evolutionSendMedia,
  evolutionSendPresence,
  evolutionSendSticker,
  evolutionSendText,
  evolutionSendWhatsAppAudio
} from "../inbound/evolutionHttpClient";
import {
  EVOLUTION_MEDIA_LIMITS,
  maxBytesForEvolutionMediaKind
} from "../inbound/evolutionMediaLimits";
import { jidToEvolutionNumber } from "./evolutionDestination";
import { mapEvolutionSendResponseToResult } from "./mapEvolutionSendResponse";

export const ERR_EVOLUTION_OPERATION_NOT_SUPPORTED =
  "ERR_EVOLUTION_OPERATION_NOT_SUPPORTED";
export const ERR_EVOLUTION_INVALID_READ_KEYS =
  "ERR_EVOLUTION_INVALID_READ_KEYS";
export const ERR_EVOLUTION_INVALID_PRESENCE = "ERR_EVOLUTION_INVALID_PRESENCE";
export const ERR_EVOLUTION_INVALID_QUOTED = "ERR_EVOLUTION_INVALID_QUOTED";
export const ERR_EVOLUTION_INVALID_DELETE_KEY =
  "ERR_EVOLUTION_INVALID_DELETE_KEY";

const MAX_READ_KEYS = 100;
const DEFAULT_PRESENCE_DELAY_MS = 5000;

function httpStatusForEvolutionCode(code: string): number {
  if (code === "ERR_EVOLUTION_TIMEOUT") return 504;
  if (
    code === "ERR_EVOLUTION_CREDENTIAL_MISSING" ||
    code === "ERR_EVOLUTION_CREDENTIAL_DECRYPT" ||
    code === ERR_EVOLUTION_INVALID_READ_KEYS ||
    code === ERR_EVOLUTION_INVALID_PRESENCE ||
    code === ERR_EVOLUTION_INVALID_QUOTED ||
    code === ERR_EVOLUTION_INVALID_DELETE_KEY
  ) {
    return 400;
  }
  return 502;
}

/**
 * Monta quoted Evolution semântico — NÃO interpreta dataJson como WAMessage/proto.
 */
export function buildEvolutionQuotedPayload(
  quoted: WhatsAppQuotedMessage
): EvolutionQuotedPayload {
  const stanzaId = String(quoted.stanzaId || "").trim();
  if (!stanzaId) {
    throw new AppError(
      ERR_EVOLUTION_INVALID_QUOTED,
      400,
      "quoted Evolution exige stanzaId"
    );
  }
  const quotedFromMe = quoted.fromMe === true;
  // Grupo + alvo de outro participante: participant identifica o autor.
  // Grupo + fromMe: Baileys 7 (Evolution 2.3.7) usa o JID da sessão;
  // não inventar participant. Outbound StreamHub persiste participant null.
  if (
    quoted.isGroup &&
    !quotedFromMe &&
    !String(quoted.participant || "").trim()
  ) {
    throw new AppError(
      ERR_EVOLUTION_INVALID_QUOTED,
      400,
      "quoted Evolution em grupo exige participant"
    );
  }

  const key: EvolutionQuotedPayload["key"] = {
    id: stanzaId,
    remoteJid: quoted.destinationJid || undefined,
    fromMe: quotedFromMe
  };
  if (quoted.isGroup && quoted.participant) {
    key.participant = String(quoted.participant).trim();
  }

  const payload: EvolutionQuotedPayload = { key };
  if (quoted.body != null && String(quoted.body).trim()) {
    payload.message = { conversation: String(quoted.body).slice(0, 2000) };
  }
  return payload;
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f) return true;
  }
  return false;
}

function normalizeReadKeys(keys: WhatsAppReadKey[]): Array<{
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}> {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new AppError(
      ERR_EVOLUTION_INVALID_READ_KEYS,
      400,
      "readMessages vazio"
    );
  }
  if (keys.length > MAX_READ_KEYS) {
    throw new AppError(
      ERR_EVOLUTION_INVALID_READ_KEYS,
      400,
      "readMessages excede limite"
    );
  }

  const out: Array<{
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  }> = [];
  const seen = new Set<string>();

  keys.forEach(key => {
    const id = String(key?.id || "").trim();
    const remoteJid = String(key?.remoteJid || "").trim();
    if (!id || !remoteJid) {
      throw new AppError(
        ERR_EVOLUTION_INVALID_READ_KEYS,
        400,
        "readMessages com id/remoteJid inválidos"
      );
    }
    if (hasControlChars(id) || hasControlChars(remoteJid)) {
      throw new AppError(
        ERR_EVOLUTION_INVALID_READ_KEYS,
        400,
        "readMessages com caracteres de controle"
      );
    }
    const dedupe = `${remoteJid}|${id}`;
    if (seen.has(dedupe)) {
      return;
    }
    seen.add(dedupe);
    const item: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    } = {
      remoteJid,
      fromMe: Boolean(key.fromMe),
      id
    };
    if (key.participant) {
      item.participant = String(key.participant).trim();
    }
    out.push(item);
  });

  if (out.length === 0) {
    throw new AppError(
      ERR_EVOLUTION_INVALID_READ_KEYS,
      400,
      "readMessages vazio após normalização"
    );
  }

  return out;
}

function toAppError(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof EvolutionHttpError) {
    throw new AppError(
      err.code,
      httpStatusForEvolutionCode(err.code),
      err.message
    );
  }
  if (
    err instanceof Error &&
    err.message === "ERR_EVOLUTION_INVALID_DESTINATION"
  ) {
    throw new AppError(
      "ERR_EVOLUTION_INVALID_DESTINATION",
      400,
      "Destino inválido para Evolution"
    );
  }
  throw err;
}

function bufferToBase64(buf: Buffer, maxBytes: number): string {
  if (buf.length > maxBytes) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TOO_LARGE",
      "Arquivo excede limite Evolution outbound"
    );
  }
  return buf.toString("base64");
}

function asBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

/**
 * Outbound Evolution (Fases 8–9A) — HTTP real via Evolution API v2.
 * Sem WASocket / Get*Wbot / Baileys / AnyMessageContent opaco genérico.
 */
/* eslint-disable class-methods-use-this */
export class EvolutionWhatsAppOutbound implements WhatsAppOutbound {
  readonly provider = "evolution" as const;

  private readonly whatsappId: number;

  constructor(whatsappId: number) {
    this.whatsappId = whatsappId;
  }

  /**
   * Campanhas exigem truthy; anti-self-send só age se houver número real.
   * Placeholder estável por conexão (não é JID WhatsApp).
   */
  getOwnUserJid(): string | null {
    return `evolution:${this.whatsappId}`;
  }

  async sendText(input: {
    jid: string;
    text: string;
    quoted?: WhatsAppQuotedMessage | null;
  }): Promise<WhatsAppOutboundSendResult> {
    try {
      const number = jidToEvolutionNumber(input.jid);
      const quoted = input.quoted
        ? buildEvolutionQuotedPayload(input.quoted)
        : undefined;
      const data = await evolutionSendText({
        whatsappId: this.whatsappId,
        number,
        text: input.text,
        quoted
      });
      const result = mapEvolutionSendResponseToResult(data, input.jid);
      if (!result.messageId) {
        throw new EvolutionHttpError(
          "ERR_EVOLUTION_INVALID_RESPONSE",
          "Evolution sendText sem message id"
        );
      }
      return result;
    } catch (err) {
      return toAppError(err);
    }
  }

  async sendContent(input: {
    jid: string;
    content: Record<string, unknown>;
  }): Promise<WhatsAppOutboundSendResult> {
    try {
      return await this.dispatchKnownContent(input.jid, input.content);
    } catch (err) {
      return toAppError(err);
    }
  }

  /**
   * DELETE /chat/deleteMessageForEveryone/{instance}.
   * Dados semânticos Message — sem WAMessage/Baileys.
   */
  async deleteMessage(input: {
    jid: string;
    target: WhatsAppDeleteTarget;
  }): Promise<void> {
    try {
      const id = String(input.target?.id || "").trim();
      const remoteJid = String(
        input.target?.remoteJid || input.jid || ""
      ).trim();
      if (!id || !remoteJid) {
        throw new AppError(
          ERR_EVOLUTION_INVALID_DELETE_KEY,
          400,
          "delete Evolution exige id e remoteJid"
        );
      }
      await evolutionDeleteMessage({
        whatsappId: this.whatsappId,
        id,
        remoteJid,
        fromMe: Boolean(input.target.fromMe),
        participant: input.target.participant
          ? String(input.target.participant).trim()
          : undefined
      });
    } catch (err) {
      toAppError(err);
    }
  }

  /**
   * POST /chat/markMessageAsRead/{instance}.
   * Sem equivalente a Baileys readMessages local — endpoint é peer-visível.
   * Sem retry cego.
   */
  async markAsRead(keys: WhatsAppReadKey[]): Promise<void> {
    try {
      const readMessages = normalizeReadKeys(keys);
      await evolutionMarkMessageAsRead({
        whatsappId: this.whatsappId,
        readMessages
      });
    } catch (err) {
      toAppError(err);
    }
  }

  /**
   * POST /chat/sendPresence/{instance} (number, presence, delay).
   * Retorna false se jid ausente.
   */
  async sendPresence(input: {
    jid?: string;
    presence: WhatsAppPresence;
    subscribe?: boolean;
  }): Promise<boolean> {
    const { presence } = input;
    if (
      presence !== "composing" &&
      presence !== "paused" &&
      presence !== "unavailable"
    ) {
      throw new AppError(
        ERR_EVOLUTION_INVALID_PRESENCE,
        400,
        "presence Evolution inválida"
      );
    }
    const jid = input.jid != null ? String(input.jid).trim() : "";
    if (!jid) {
      return false;
    }
    try {
      const number = jidToEvolutionNumber(jid);
      await evolutionSendPresence({
        whatsappId: this.whatsappId,
        number,
        presence,
        delay:
          presence === "composing"
            ? DEFAULT_PRESENCE_DELAY_MS
            : Math.min(DEFAULT_PRESENCE_DELAY_MS, 1000)
      });
      return true;
    } catch (err) {
      return toAppError(err);
    }
  }

  private async dispatchKnownContent(
    jid: string,
    content: Record<string, unknown>
  ): Promise<WhatsAppOutboundSendResult> {
    const number = jidToEvolutionNumber(jid);

    if (content.image != null) {
      return this.sendBinaryMedia({
        jid,
        number,
        mediatype: "image",
        binary: content.image,
        caption: typeof content.caption === "string" ? content.caption : "",
        mimetype:
          typeof content.mimetype === "string"
            ? content.mimetype
            : "image/jpeg",
        fileName:
          typeof content.fileName === "string" ? content.fileName : "image.jpg"
      });
    }

    if (content.video != null) {
      return this.sendBinaryMedia({
        jid,
        number,
        mediatype: "video",
        binary: content.video,
        caption: typeof content.caption === "string" ? content.caption : "",
        mimetype:
          typeof content.mimetype === "string" ? content.mimetype : "video/mp4",
        fileName:
          typeof content.fileName === "string" ? content.fileName : "video.mp4"
      });
    }

    if (content.document != null) {
      return this.sendBinaryMedia({
        jid,
        number,
        mediatype: "document",
        binary: content.document,
        caption: typeof content.caption === "string" ? content.caption : "",
        mimetype:
          typeof content.mimetype === "string"
            ? content.mimetype
            : "application/octet-stream",
        fileName:
          typeof content.fileName === "string"
            ? content.fileName
            : "document.bin"
      });
    }

    if (content.audio != null) {
      const buf = asBuffer(content.audio);
      if (!buf) {
        throw new EvolutionHttpError(
          "ERR_EVOLUTION_INVALID_MEDIA",
          "Áudio Evolution requer Buffer"
        );
      }
      const isPtt = Boolean(content.ptt);
      const max = maxBytesForEvolutionMediaKind("audio");
      const b64 = bufferToBase64(buf, max);
      const data = isPtt
        ? await evolutionSendWhatsAppAudio({
            whatsappId: this.whatsappId,
            number,
            audio: b64
          })
        : await evolutionSendMedia({
            whatsappId: this.whatsappId,
            number,
            mediatype: "audio",
            media: b64,
            mimetype:
              typeof content.mimetype === "string"
                ? content.mimetype
                : "audio/mpeg",
            fileName: "audio.mp3",
            caption: typeof content.caption === "string" ? content.caption : ""
          });
      const result = mapEvolutionSendResponseToResult(data, jid);
      if (!result.messageId) {
        throw new EvolutionHttpError(
          "ERR_EVOLUTION_INVALID_RESPONSE",
          "Evolution sendAudio sem message id"
        );
      }
      return result;
    }

    if (content.sticker != null) {
      const buf = asBuffer(content.sticker);
      if (!buf) {
        throw new EvolutionHttpError(
          "ERR_EVOLUTION_INVALID_MEDIA",
          "Sticker Evolution requer Buffer"
        );
      }
      const max = Math.min(
        maxBytesForEvolutionMediaKind("sticker"),
        EVOLUTION_MEDIA_LIMITS.stickerMaxBytes
      );
      const data = await evolutionSendSticker({
        whatsappId: this.whatsappId,
        number,
        sticker: bufferToBase64(buf, max),
        notConvertSticker: true
      });
      const result = mapEvolutionSendResponseToResult(data, jid);
      if (!result.messageId) {
        throw new EvolutionHttpError(
          "ERR_EVOLUTION_INVALID_RESPONSE",
          "Evolution sendSticker sem message id"
        );
      }
      return result;
    }

    if (typeof content.text === "string") {
      return this.sendText({ jid, text: content.text });
    }

    throw new AppError(
      ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
      400,
      "sendContent Evolution: shape de mídia não suportado"
    );
  }

  private async sendBinaryMedia(input: {
    jid: string;
    number: string;
    mediatype: "image" | "video" | "document";
    binary: unknown;
    caption: string;
    mimetype: string;
    fileName: string;
  }): Promise<WhatsAppOutboundSendResult> {
    const buf = asBuffer(input.binary);
    if (!buf) {
      throw new EvolutionHttpError(
        "ERR_EVOLUTION_INVALID_MEDIA",
        "Mídia Evolution requer Buffer"
      );
    }
    const safeName = String(input.fileName || "file")
      .replace(/[/\\]/g, "_")
      .replace(/\.\./g, "");
    const max = maxBytesForEvolutionMediaKind(input.mediatype);
    const data = await evolutionSendMedia({
      whatsappId: this.whatsappId,
      number: input.number,
      mediatype: input.mediatype,
      media: bufferToBase64(buf, max),
      mimetype: input.mimetype,
      fileName: safeName || "file",
      caption: input.caption
    });
    const result = mapEvolutionSendResponseToResult(data, input.jid);
    if (!result.messageId) {
      throw new EvolutionHttpError(
        "ERR_EVOLUTION_INVALID_RESPONSE",
        "Evolution sendMedia sem message id"
      );
    }
    return result;
  }
}
