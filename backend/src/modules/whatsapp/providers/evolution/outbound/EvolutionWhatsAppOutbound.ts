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
  evolutionSendMedia,
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

function httpStatusForEvolutionCode(code: string): number {
  if (code === "ERR_EVOLUTION_TIMEOUT") return 504;
  if (
    code === "ERR_EVOLUTION_CREDENTIAL_MISSING" ||
    code === "ERR_EVOLUTION_CREDENTIAL_DECRYPT"
  ) {
    return 400;
  }
  return 502;
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
 * Outbound Evolution (Fase 8) — HTTP real via Evolution API v2.
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
    if (input.quoted) {
      throw new AppError(
        ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
        400,
        "Quoted/reply Evolution ainda não suportado (Fase 9)."
      );
    }
    try {
      const number = jidToEvolutionNumber(input.jid);
      const data = await evolutionSendText({
        whatsappId: this.whatsappId,
        number,
        text: input.text
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

  async deleteMessage(_input: {
    jid: string;
    target: WhatsAppDeleteTarget;
  }): Promise<void> {
    throw new AppError(
      ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
      400,
      "deleteMessage Evolution ainda não suportado (Fase 9)."
    );
  }

  async markAsRead(_keys: WhatsAppReadKey[]): Promise<void> {
    throw new AppError(
      ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
      400,
      "markAsRead Evolution ainda não suportado (Fase 9)."
    );
  }

  async sendPresence(_input: {
    jid?: string;
    presence: WhatsAppPresence;
    subscribe?: boolean;
  }): Promise<boolean> {
    return false;
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
        sticker: bufferToBase64(buf, max)
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
