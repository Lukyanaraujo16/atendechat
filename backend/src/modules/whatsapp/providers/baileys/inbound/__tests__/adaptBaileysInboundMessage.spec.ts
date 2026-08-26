/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => {
  function unwrap(
    message: Record<string, unknown> | null | undefined,
    depth = 0
  ): Record<string, unknown> | null | undefined {
    if (!message || depth > 8) return message;
    const nested = message as {
      ephemeralMessage?: { message?: Record<string, unknown> };
      viewOnceMessage?: { message?: Record<string, unknown> };
      viewOnceMessageV2?: { message?: Record<string, unknown> };
      documentWithCaptionMessage?: { message?: Record<string, unknown> };
    };
    const next =
      nested.ephemeralMessage?.message ||
      nested.viewOnceMessage?.message ||
      nested.viewOnceMessageV2?.message ||
      nested.documentWithCaptionMessage?.message;
    if (next) return unwrap(next, depth + 1) || next;
    return message;
  }

  return {
    getContentType: (message: Record<string, unknown> | null | undefined) => {
      if (!message) return undefined;
      const keys = Object.keys(message);
      return keys.find(
        k =>
          (k === "conversation" ||
            k === "editedMessage" ||
            k.endsWith("Message")) &&
          k !== "senderKeyDistributionMessage" &&
          k !== "messageContextInfo"
      );
    },
    extractMessageContent: (
      message: Record<string, unknown> | null | undefined
    ) => unwrap(message),
    proto: {}
  };
});

jest.mock("@sentry/node", () => ({
  setExtra: jest.fn(),
  captureException: jest.fn()
}));

jest.mock("../../../../../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

import { proto } from "@whiskeysockets/baileys";
import { adaptBaileysInboundMessage } from "../adaptBaileysInboundMessage";
import {
  getBodyMessage,
  getQuotedMessageId,
  getTypeMessage
} from "../baileysInboundParsing";

const ctx = { companyId: 10, whatsappId: 3 };

function asMsg(partial: Record<string, unknown>): proto.IWebMessageInfo {
  return partial as proto.IWebMessageInfo;
}

describe("adaptBaileysInboundMessage", () => {
  it("normaliza mensagem de texto comum", () => {
    const msg = asMsg({
      key: {
        id: "TXT1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      pushName: "Ana",
      messageTimestamp: 1700000000,
      message: { conversation: "Olá, tudo bem?" }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.provider).toBe("baileys");
    expect(inbound.companyId).toBe(10);
    expect(inbound.whatsappId).toBe(3);
    expect(inbound.messageId).toBe("TXT1");
    expect(inbound.fromMe).toBe(false);
    expect(inbound.isGroup).toBe(false);
    expect(inbound.messageType).toBe("conversation");
    expect(inbound.body).toBe("Olá, tudo bem?");
    expect(inbound.pushName).toBe("Ana");
    expect(inbound.addressing.remoteJid).toBe("5511999887766@s.whatsapp.net");
    expect(inbound.senderNumber).toBe("5511999887766");
    expect(inbound.timestamp).toEqual(new Date(1700000000 * 1000));
    expect(inbound.rawProviderMessage).toBe(msg);
    expect(inbound.body).toBe(getBodyMessage(msg));
    expect(inbound.messageType).toBe(getTypeMessage(msg));
  });

  it("preserva fromMe sem alterar o id", () => {
    const msg = asMsg({
      key: {
        id: "FROM_ME_1",
        remoteJid: "5511888777666@s.whatsapp.net",
        fromMe: true
      },
      message: { conversation: "Resposta do atendente" }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.fromMe).toBe(true);
    expect(inbound.messageId).toBe("FROM_ME_1");
    expect(inbound.body).toBe("Resposta do atendente");
    expect(inbound.rawProviderMessage).toBe(msg);
  });

  it("extrai quoted stanzaId de extendedText sem reescrever o id", () => {
    const msg = asMsg({
      key: {
        id: "QUOTE1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: {
        extendedTextMessage: {
          text: "respondendo",
          contextInfo: {
            stanzaId: "ORIG_MSG_ID",
            mentionedJid: ["5511888777666@s.whatsapp.net"]
          }
        }
      }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.messageType).toBe("extendedTextMessage");
    expect(inbound.body).toBe("respondendo");
    expect(inbound.quotedStanzaId).toBe("ORIG_MSG_ID");
    expect(inbound.quotedStanzaId).toBe(getQuotedMessageId(msg));
    expect(inbound.mentionedJids).toEqual(["5511888777666@s.whatsapp.net"]);
    expect(inbound.messageId).toBe("QUOTE1");
  });

  it("preserva JID de grupo e participant", () => {
    const msg = asMsg({
      key: {
        id: "GRP1",
        remoteJid: "120363999888777666@g.us",
        participant: "5511888777666@s.whatsapp.net",
        participantPn: "5511888777666@s.whatsapp.net",
        fromMe: false
      },
      pushName: "Carlos",
      message: { conversation: "oi grupo" }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.isGroup).toBe(true);
    expect(inbound.addressing.remoteJid).toBe("120363999888777666@g.us");
    expect(inbound.addressing.participant).toBe("5511888777666@s.whatsapp.net");
    expect(inbound.addressing.participantPn).toBe(
      "5511888777666@s.whatsapp.net"
    );
    expect(inbound.senderNumber).toBe("5511888777666");
    expect(inbound.messageId).toBe("GRP1");
  });

  it("preserva LID/PN sem reescrever remoteJid", () => {
    const msg = asMsg({
      key: {
        id: "LID1",
        remoteJid: "123456789012345@lid",
        senderPn: "5511999887766@s.whatsapp.net",
        remoteJidAlt: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: { conversation: "via lid" }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.addressing.remoteJid).toBe("123456789012345@lid");
    expect(inbound.addressing.senderPn).toBe("5511999887766@s.whatsapp.net");
    expect(inbound.addressing.remoteJidAlt).toBe(
      "5511999887766@s.whatsapp.net"
    );
    expect(inbound.senderNumber).toBe("5511999887766");
    expect(inbound.messageId).toBe("LID1");
  });

  it("normaliza áudio PTT sem baixar mídia", () => {
    const msg = asMsg({
      key: {
        id: "PTT1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: {
        audioMessage: {
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          seconds: 3
        }
      }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.messageType).toBe("audioMessage");
    expect(inbound.body).toBe("Áudio");
    expect(inbound.media.hasMedia).toBe(true);
    expect(inbound.media.isPtt).toBe(true);
    expect(inbound.media.mimetype).toBe("audio/ogg; codecs=opus");
    expect(inbound.rawProviderMessage).toBe(msg);
  });

  it("normaliza metadados de imagem sem alterar download", () => {
    const msg = asMsg({
      key: {
        id: "IMG1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: {
        imageMessage: {
          mimetype: "image/jpeg",
          caption: "foto da fatura",
          fileName: "photo.jpg"
        }
      }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.messageType).toBe("imageMessage");
    expect(inbound.body).toBe("foto da fatura");
    expect(inbound.media.hasMedia).toBe(true);
    expect(inbound.media.mimetype).toBe("image/jpeg");
    expect(inbound.media.caption).toBe("foto da fatura");
    expect(inbound.rawProviderMessage).toBe(msg);
  });

  it("marca wrapping ephemeral e preserva equivalência de body (sem unwrap no body)", () => {
    const msg = asMsg({
      key: {
        id: "EPH1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: {
        ephemeralMessage: {
          message: { conversation: "secreto" }
        }
      }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.wrapping.isEphemeral).toBe(true);
    expect(inbound.wrapping.isViewOnce).toBe(false);
    expect(inbound.messageType).toBe("conversation");
    expect(inbound.body).toBe("[Conteúdo: conversation]");
    expect(inbound.body).toBe(getBodyMessage(msg));
  });

  it("marca wrapping viewOnce e extrai mídia do conteúdo interno", () => {
    const msg = asMsg({
      key: {
        id: "VO1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: false
      },
      message: {
        viewOnceMessage: {
          message: {
            imageMessage: {
              mimetype: "image/jpeg",
              caption: "view once"
            }
          }
        }
      }
    });

    const inbound = adaptBaileysInboundMessage(msg, ctx);

    expect(inbound.wrapping.isViewOnce).toBe(true);
    expect(inbound.messageType).toBe("imageMessage");
    expect(inbound.media.hasMedia).toBe(true);
    expect(inbound.media.mimetype).toBe("image/jpeg");
    expect(inbound.body).toBe(getBodyMessage(msg));
  });

  it("equivalência de body/tipo para sticker, documento, contato, reação e localização", () => {
    const cases: Array<{ msg: proto.IWebMessageInfo; type: string }> = [
      {
        type: "stickerMessage",
        msg: asMsg({
          key: { id: "STK", remoteJid: "5511@s.whatsapp.net" },
          message: { stickerMessage: { mimetype: "image/webp" } }
        })
      },
      {
        type: "documentMessage",
        msg: asMsg({
          key: { id: "DOC", remoteJid: "5511@s.whatsapp.net" },
          message: {
            documentMessage: {
              mimetype: "application/pdf",
              fileName: "boleto.pdf",
              caption: "boleto"
            }
          }
        })
      },
      {
        type: "contactMessage",
        msg: asMsg({
          key: { id: "VCF", remoteJid: "5511@s.whatsapp.net" },
          message: { contactMessage: { vcard: "BEGIN:VCARD" } }
        })
      },
      {
        type: "reactionMessage",
        msg: asMsg({
          key: { id: "REA", remoteJid: "5511@s.whatsapp.net" },
          message: { reactionMessage: { text: "👍" } }
        })
      },
      {
        type: "locationMessage",
        msg: asMsg({
          key: { id: "LOC", remoteJid: "5511@s.whatsapp.net" },
          message: {
            locationMessage: {
              degreesLatitude: -23.5,
              degreesLongitude: -46.6
            }
          }
        })
      }
    ];

    cases.forEach(item => {
      const inbound = adaptBaileysInboundMessage(item.msg, ctx);
      expect(inbound.messageType).toBe(item.type);
      expect(inbound.messageType).toBe(getTypeMessage(item.msg));
      expect(inbound.body).toBe(getBodyMessage(item.msg));
      expect(inbound.rawProviderMessage).toBe(item.msg);
    });
  });
});
