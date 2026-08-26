import { proto } from "@whiskeysockets/baileys";
import { extractMessageReceivedAt } from "../../../../../helpers/extractMessageReceivedAt";
import {
  extractInboundJidMeta,
  normalizeWhatsAppJidToNumber
} from "../../../../../helpers/normalizeWhatsAppJidToNumber";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";
import {
  extractBaileysMediaMetadata,
  extractBaileysWrapping,
  extractMentionedJids,
  getBodyMessage,
  getQuotedMessageId,
  getTypeMessage
} from "./baileysInboundParsing";

export type AdaptBaileysInboundContext = {
  companyId: number;
  whatsappId: number;
};

/**
 * Converte proto.IWebMessageInfo → NormalizedWhatsAppMessage.
 *
 * Única camada que deve conhecer estruturas Baileys no inbound futuro.
 * Nesta fase o payload cru permanece em rawProviderMessage para o handler legado.
 */
export function adaptBaileysInboundMessage(
  msg: proto.IWebMessageInfo,
  context: AdaptBaileysInboundContext
): NormalizedWhatsAppMessage {
  const meta = extractInboundJidMeta(msg);
  const isGroup = meta.remoteJid.endsWith("@g.us");
  const messageType = getTypeMessage(msg) || null;
  const quotedStanzaId = (() => {
    try {
      const quoted = getQuotedMessageId(msg);
      return quoted != null && String(quoted).length > 0
        ? String(quoted)
        : null;
    } catch {
      return null;
    }
  })();

  const senderNumber = normalizeWhatsAppJidToNumber(
    isGroup ? meta.participant || meta.remoteJid : meta.remoteJid,
    {
      senderPn: meta.senderPn,
      remoteJidAlt: meta.remoteJidAlt,
      participantPn: meta.participantPn
    }
  );

  return {
    provider: "baileys",
    companyId: context.companyId,
    whatsappId: context.whatsappId,
    messageId: msg.key?.id != null ? String(msg.key.id) : "",
    fromMe: Boolean(msg.key?.fromMe),
    timestamp: extractMessageReceivedAt(msg),
    messageType,
    body: getBodyMessage(msg),
    pushName: msg.pushName != null ? String(msg.pushName) : null,
    isGroup,
    addressing: {
      remoteJid: meta.remoteJid,
      participant: meta.participant,
      senderPn: meta.senderPn,
      remoteJidAlt: meta.remoteJidAlt,
      participantPn: meta.participantPn
    },
    senderNumber,
    quotedStanzaId,
    mentionedJids: extractMentionedJids(msg),
    media: extractBaileysMediaMetadata(msg),
    wrapping: extractBaileysWrapping(msg),
    messageStubType:
      msg.messageStubType != null ? Number(msg.messageStubType) : null,
    rawProviderMessage: msg
  };
}
