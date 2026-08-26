import * as Sentry from "@sentry/node";
import {
  extractMessageContent,
  getContentType,
  proto
} from "@whiskeysockets/baileys";
import { logger } from "../../../../../utils/logger";

/**
 * Parsing Baileys inbound. Conhece proto / getContentType / ephemeral / viewOnce.
 * Extraído de wbotMessageListener sem alteração funcional.
 *
 * O bloco legado (body/quoted/buttons/location) replica o código original;
 * lint do trecho copiado é desabilitado para não mudar comportamento.
 */
/* eslint-disable consistent-return, no-restricted-syntax, no-unsafe-optional-chaining, vars-on-top, no-var, prefer-const, no-unused-expressions, @typescript-eslint/no-explicit-any, prettier/prettier, quotes */

/** Desembrulha ephemeral/viewOnce/documentWithCaption para o tipo real (evita perda por tipo “vazio”). */
export function unwrapMessageContent(
  message: proto.IMessage | null | undefined,
  depth = 0
): proto.IMessage | null | undefined {
  if (!message || depth > 8) return message || undefined;
  const m = message as proto.IMessage & {
    ephemeralMessage?: { message?: proto.IMessage };
    viewOnceMessage?: { message?: proto.IMessage };
    viewOnceMessageV2?: { message?: proto.IMessage };
  };
  const next =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.documentWithCaptionMessage?.message;
  if (next) {
    return unwrapMessageContent(next, depth + 1) || next;
  }
  return message;
}

export const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const base = unwrapMessageContent(msg.message);
  return getContentType(base);
};

const getBodyButton = (msg: proto.IWebMessageInfo): string => {
  if (
    msg.key.fromMe &&
    msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText
  ) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;

    for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage
      ?.buttons) {
      bodyMessage += `\n\n${buton.buttonText?.displayText}`;
    }
    return bodyMessage;
  }

  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
    for (const buton of msg.message?.viewOnceMessage?.message?.listMessage
      ?.sections) {
      for (const rows of buton.rows) {
        bodyMessage += `\n\n${rows.title}`;
      }
    }

    return bodyMessage;
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);

    const types = {
      conversation: msg?.message?.conversation,
      editedMessage:
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedButtonId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      viewOnceMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage: "varios contatos",
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.caption,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      audioMessage: "Áudio",
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      listResponseMessage:
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction"
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(
        `[WhatsAppInbound] unsupported_body_extract type=${type || "unknown"} messageId=${msg.key?.id ?? ""} remoteJid=${msg.key?.remoteJid ?? ""}`
      );
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getBodyMessage")
      );
      return `[Conteúdo: ${type || "mensagem"}]`;
    }
    const raw = types[type];
    if (raw === undefined || raw === null) {
      logger.warn(
        `[WhatsAppInbound] unsupported_body_extract type=${type} messageId=${msg.key?.id ?? ""} (campo vazio)`
      );
      return `[Conteúdo: ${type}]`;
    }
    return raw;
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    logger.error(
      { err: error, stack: error instanceof Error ? error.stack : undefined },
      `[WhatsAppInbound] error_processing context=getBodyMessage`
    );
    return "[Erro ao ler o conteúdo da mensagem]";
  }
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo): any => {
  const body =
    msg.message.imageMessage.contextInfo ||
    msg.message.videoMessage.contextInfo ||
    msg.message?.documentMessage ||
    msg.message.extendedTextMessage.contextInfo ||
    msg.message.buttonsResponseMessage.contextInfo ||
    msg.message.listResponseMessage.contextInfo ||
    msg.message.templateButtonReplyMessage.contextInfo ||
    msg.message.buttonsResponseMessage?.contextInfo ||
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
    msg.message.listResponseMessage?.contextInfo;
  msg.message.senderKeyDistributionMessage;

  // testar isso

  return extractMessageContent(body[Object.keys(body).values().next().value]);
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

export function extractMentionedJids(msg: proto.IWebMessageInfo): string[] {
  try {
    const unwrapped = unwrapMessageContent(msg.message);
    const extracted = extractMessageContent(unwrapped || msg.message);
    if (!extracted) return [];
    const firstKey = Object.keys(extracted)[0];
    const node = firstKey ? (extracted as Record<string, any>)[firstKey] : null;
    const mentioned = node?.contextInfo?.mentionedJid;
    if (!Array.isArray(mentioned)) return [];
    return mentioned.filter(jid => typeof jid === "string" && jid.length > 0);
  } catch {
    return [];
  }
}

export function extractBaileysMediaMetadata(msg: proto.IWebMessageInfo): {
  hasMedia: boolean;
  mimetype: string | null;
  filename: string | null;
  caption: string | null;
  isPtt: boolean;
} {
  const effective = unwrapMessageContent(msg.message);
  const hasMedia = !!(
    effective?.audioMessage ||
    effective?.imageMessage ||
    effective?.videoMessage ||
    effective?.documentMessage ||
    effective?.documentWithCaptionMessage ||
    effective?.stickerMessage
  );

  const document =
    effective?.documentMessage ||
    effective?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage;

  const mediaNode =
    effective?.imageMessage ||
    effective?.audioMessage ||
    effective?.videoMessage ||
    effective?.stickerMessage ||
    document ||
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage;

  return {
    hasMedia,
    mimetype: mediaNode?.mimetype || document?.mimetype || null,
    filename: document?.fileName || null,
    caption:
      effective?.imageMessage?.caption ||
      effective?.videoMessage?.caption ||
      document?.caption ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      null,
    isPtt: Boolean(
      effective?.audioMessage?.ptt || msg.message?.audioMessage?.ptt
    )
  };
}

export function extractEditedMessageId(msg: proto.IWebMessageInfo): string | null {
  const id =
    msg?.message?.editedMessage?.message?.protocolMessage?.key?.id;
  if (id == null || String(id).length === 0) {
    return null;
  }
  return String(id);
}

export function extractBaileysAck(msg: proto.IWebMessageInfo): number | null {
  if (msg.status == null) return null;
  const n = Number(msg.status);
  return Number.isFinite(n) ? n : null;
}

export function extractBaileysWrapping(msg: proto.IWebMessageInfo): {
  isEphemeral: boolean;
  isViewOnce: boolean;
} {
  const m = msg.message as proto.IMessage & {
    ephemeralMessage?: { message?: proto.IMessage };
    viewOnceMessage?: { message?: proto.IMessage };
    viewOnceMessageV2?: { message?: proto.IMessage };
  };
  return {
    isEphemeral: Boolean(m?.ephemeralMessage),
    isViewOnce: Boolean(m?.viewOnceMessage || m?.viewOnceMessageV2)
  };
}
