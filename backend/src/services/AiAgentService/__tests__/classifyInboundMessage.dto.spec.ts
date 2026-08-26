/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: (message: Record<string, unknown> | null | undefined) => {
    if (!message) return undefined;
    return Object.keys(message).find(
      k =>
        (k === "conversation" || k.endsWith("Message")) &&
        k !== "senderKeyDistributionMessage" &&
        k !== "messageContextInfo"
    );
  },
  proto: {}
}));

import {
  classifyInboundMessage,
  classifyInboundMessageFromNormalized
} from "../classifyInboundMessage";
import type { NormalizedWhatsAppMessage } from "../../../modules/whatsapp/inbound/NormalizedWhatsAppMessage";

function baseInbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "baileys",
    companyId: 1,
    whatsappId: 1,
    messageId: "M1",
    fromMe: false,
    timestamp: null,
    messageType: "conversation",
    body: "Olá",
    pushName: "Ana",
    isGroup: false,
    addressing: {
      remoteJid: "5511999887766@s.whatsapp.net",
      participant: ""
    },
    senderNumber: "5511999887766",
    quotedStanzaId: null,
    mentionedJids: [],
    media: {
      hasMedia: false,
      mimetype: null,
      filename: null,
      caption: null,
      isPtt: false
    },
    wrapping: { isEphemeral: false, isViewOnce: false },
    messageStubType: null,
    ack: null,
    editedMessageId: null,
    rawProviderMessage: {},
    ...partial
  };
}

describe("classifyInboundMessage (DTO)", () => {
  it("texto válido não bloqueia", () => {
    const c = classifyInboundMessageFromNormalized(baseInbound());
    expect(c.messageType).toBe("text");
    expect(c.hasText).toBe(true);
    expect(c.blockReason).toBeUndefined();
  });

  it("áudio PTT via DTO é multimodal", () => {
    const c = classifyInboundMessageFromNormalized(
      baseInbound({
        messageType: "audioMessage",
        body: "Áudio",
        media: {
          hasMedia: true,
          mimetype: "audio/ogg; codecs=opus",
          filename: null,
          caption: null,
          isPtt: true
        }
      })
    );
    expect(c.messageType).toBe("audio");
    expect(c.hasMedia).toBe(true);
    expect(c.blockReason).toBeUndefined();
  });

  it("imagem sem legenda via DTO é multimodal", () => {
    const c = classifyInboundMessage({
      messageType: "imageMessage",
      body: null,
      hasMedia: true,
      mediaCaption: null
    });
    expect(c.messageType).toBe("image");
    expect(c.hasMedia).toBe(true);
    expect(c.blockReason).toBeUndefined();
  });

  it("imagem Evolution via DTO classifica multimodal sem raw", () => {
    const c = classifyInboundMessageFromNormalized(
      baseInbound({
        provider: "evolution",
        messageType: "imageMessage",
        body: "foto",
        rawProviderMessage: null,
        media: {
          hasMedia: true,
          mimetype: "image/jpeg",
          filename: "a.jpg",
          caption: "foto",
          isPtt: false
        }
      })
    );
    expect(c.messageType).toBe("image");
    expect(c.hasMedia).toBe(true);
    expect(c.blockReason).toBeUndefined();
  });

  it("reação bloqueia unsupported_message_type", () => {
    const c = classifyInboundMessageFromNormalized(
      baseInbound({
        messageType: "reactionMessage",
        body: "reaction"
      })
    );
    expect(c.blockReason).toBe("unsupported_message_type");
  });

  it("quoted/LID/grupo não alteram classificação de texto", () => {
    const c = classifyInboundMessageFromNormalized(
      baseInbound({
        isGroup: true,
        quotedStanzaId: "ORIG",
        addressing: {
          remoteJid: "120363@g.us",
          participant: "123@lid",
          participantPn: "5511999887766@s.whatsapp.net"
        }
      })
    );
    expect(c.messageType).toBe("text");
    expect(c.hasText).toBe(true);
  });
});
