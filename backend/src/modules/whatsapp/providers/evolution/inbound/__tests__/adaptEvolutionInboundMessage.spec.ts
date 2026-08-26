/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => undefined,
  proto: {}
}));

import {
  adaptEvolutionInboundMessage,
  buildEvolutionExternalEventId
} from "../adaptEvolutionInboundMessage";
import { EvolutionWebhookEnvelope } from "../evolutionWebhookTypes";

function textEnvelope(
  partial: Partial<EvolutionWebhookEnvelope> = {}
): EvolutionWebhookEnvelope {
  return {
    event: "MESSAGES_UPSERT",
    instance: "my-whatsapp",
    data: {
      key: {
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: false,
        id: "3EB0C7B4E7A2B8E6D4F1"
      },
      pushName: "John Doe",
      message: { conversation: "Olá, preciso de ajuda" },
      messageType: "conversation",
      messageTimestamp: 1709553296
    },
    date_time: "2026-03-04T12:34:56.789Z",
    sender: "5511999998888@s.whatsapp.net",
    apikey: "SHOULD_NOT_APPEAR_IN_DTO",
    ...partial
  };
}

describe("adaptEvolutionInboundMessage", () => {
  it("mapeia texto MESSAGES_UPSERT para NormalizedWhatsAppMessage", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope(),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inbound.provider).toBe("evolution");
    expect(result.inbound.body).toBe("Olá, preciso de ajuda");
    expect(result.inbound.messageId).toBe("3EB0C7B4E7A2B8E6D4F1");
    expect(result.inbound.fromMe).toBe(false);
    expect(result.inbound.pushName).toBe("John Doe");
    expect(result.inbound.senderNumber).toBe("5511999998888");
    expect(result.inbound.rawProviderMessage).toBeNull();
    expect(result.inbound.isGroup).toBe(false);
    expect(result.inbound.timestamp).toBeInstanceOf(Date);
  });

  it("aceita event messages.upsert e extendedText + quoted", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5511888777666@s.whatsapp.net",
            fromMe: true,
            id: "MSG2"
          },
          message: {
            extendedTextMessage: {
              text: "reply",
              contextInfo: { stanzaId: "QUOTED1" }
            }
          },
          messageType: "extendedTextMessage",
          messageTimestamp: 1709553300
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inbound.fromMe).toBe(true);
    expect(result.inbound.body).toBe("reply");
    expect(result.inbound.quotedStanzaId).toBe("QUOTED1");
  });

  it("mapeia grupo com participant", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "120363111@g.us",
            participant: "5511777666555@s.whatsapp.net",
            fromMe: false,
            id: "G1"
          },
          message: { conversation: "oi grupo" },
          messageType: "conversation",
          messageTimestamp: 1709553301
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inbound.isGroup).toBe(true);
    expect(result.inbound.addressing.participant).toBe(
      "5511777666555@s.whatsapp.net"
    );
    expect(result.inbound.senderNumber).toBe("5511777666555");
  });

  it("mapeia imagem com e sem caption", () => {
    const withCaption = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "IMG1"
          },
          message: {
            imageMessage: {
              mimetype: "image/jpeg",
              caption: "foto",
              base64: "aaaa"
            }
          },
          messageType: "imageMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(withCaption.ok).toBe(true);
    if (!withCaption.ok) return;
    expect(withCaption.inbound.media.hasMedia).toBe(true);
    expect(withCaption.inbound.media.caption).toBe("foto");
    expect(withCaption.inbound.body).toBe("foto");
    expect(withCaption.inbound.rawProviderMessage).toBeNull();
    expect(withCaption.mediaHints?.inlineBase64).toBe("aaaa");

    const noCaption = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "IMG2"
          },
          message: { imageMessage: { mimetype: "image/png" } },
          messageType: "imageMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(noCaption.ok).toBe(true);
    if (!noCaption.ok) return;
    expect(noCaption.inbound.body).toBe("Imagem");
    expect(noCaption.inbound.media.caption).toBeNull();
  });

  it("mapeia video, audio PTT, document, sticker", () => {
    const video = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "V1"
          },
          message: {
            videoMessage: { mimetype: "video/mp4", caption: "clip" }
          },
          messageType: "videoMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(video.ok && video.inbound.media.hasMedia).toBe(true);
    expect(video.ok && video.inbound.body).toBe("clip");

    const ptt = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "A1"
          },
          message: {
            audioMessage: {
              mimetype: "audio/ogg; codecs=opus",
              ptt: true
            }
          },
          messageType: "audioMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(ptt.ok && ptt.inbound.media.isPtt).toBe(true);
    expect(ptt.ok && ptt.inbound.body).toBe("Áudio");

    const doc = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "D1"
          },
          message: {
            documentMessage: {
              mimetype: "application/pdf",
              fileName: "contrato.pdf"
            }
          },
          messageType: "documentMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(doc.ok && doc.inbound.media.filename).toBe("contrato.pdf");

    const sticker = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "S1"
          },
          message: { stickerMessage: { mimetype: "image/webp" } },
          messageType: "stickerMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(sticker.ok && sticker.inbound.body).toBe("sticker");
  });

  it("mapeia location, contact, contacts array, reaction", () => {
    const loc = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "L1"
          },
          message: {
            locationMessage: {
              degreesLatitude: -23.5,
              degreesLongitude: -46.6,
              name: "Escritório"
            }
          },
          messageType: "locationMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(loc.ok && loc.inbound.media.hasMedia).toBe(false);
    expect(loc.ok && loc.inbound.body).toContain("maps.google.com");

    const contact = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "C1"
          },
          message: {
            contactMessage: {
              displayName: "Ana",
              vcard: "BEGIN:VCARD\nFN:Ana\nEND:VCARD"
            }
          },
          messageType: "contactMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(contact.ok && contact.inbound.body).toContain("VCARD");

    const contacts = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "C2"
          },
          message: { contactsArrayMessage: { contacts: [] } },
          messageType: "contactsArrayMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(contacts.ok && contacts.inbound.body).toBe("varios contatos");

    const reaction = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "R1"
          },
          message: {
            reactionMessage: {
              text: "👍",
              key: { id: "TARGET1" }
            }
          },
          messageType: "reactionMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(reaction.ok && reaction.inbound.body).toBe("👍");
    expect(reaction.ok && reaction.inbound.quotedStanzaId).toBe("TARGET1");
  });

  it("skip controlado para tipo ainda não suportado", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "B1"
          },
          message: { buttonsMessage: {} },
          messageType: "buttonsMessage",
          messageTimestamp: 1
        }
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "unsupported_message_type" });
  });

  it("skip LID sem PN", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope({
        data: {
          key: {
            remoteJid: "123456789012345@lid",
            fromMe: false,
            id: "LID1"
          },
          message: { conversation: "oi" },
          messageType: "conversation",
          messageTimestamp: 1
        },
        sender: undefined
      }),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "unresolvable_contact" });
  });

  it("evento desconhecido", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope({ event: "CONNECTION_UPDATE" }),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "unsupported_event" });
  });

  it("externalEventId estável por message id", () => {
    expect(
      buildEvolutionExternalEventId({
        whatsappId: 10,
        messageId: "ABC",
        eventType: "MESSAGES_UPSERT"
      })
    ).toBe("evo:10:ABC");
  });

  it("adapter não importa baileys (smoke via ausência de raw)", () => {
    const result = adaptEvolutionInboundMessage({
      envelope: textEnvelope(),
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inbound.rawProviderMessage).toBeNull();
    expect(result.inbound.provider).toBe("evolution");
  });

  it("fonte do adapter não referencia @whiskeysockets/baileys", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path") as typeof import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../adaptEvolutionInboundMessage.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/@whiskeysockets\/baileys/);
    expect(src).not.toMatch(/from\s+["'].*baileys/);
    expect(src).not.toMatch(/\bWAMessage\b/);
    expect(src).not.toMatch(/\bIWebMessageInfo\b/);
  });
});
