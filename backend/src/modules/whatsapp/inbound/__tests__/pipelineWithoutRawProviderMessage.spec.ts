/**
 * Contrato Fase 4: NormalizedWhatsAppMessage sem rawProviderMessage
 * deve atravessar partes provider-agnostic do pipeline.
 * Não fabrica proto falso — depende só do DTO.
 */
/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

import {
  OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE,
  processInboundWhatsAppMessage
} from "../ProcessInboundWhatsAppMessage";
import {
  NormalizedWhatsAppMessage,
  PHASE5_BAILEYS_RAW_CONSUMERS
} from "../NormalizedWhatsAppMessage";
import { resolveQuotedMessageByStanzaId } from "../resolveQuotedMessageByStanzaId";
import { classifyInboundMessageFromNormalized } from "../../../../services/AiAgentService/classifyInboundMessage";
import { tryGetBaileysRawMessage } from "../../providers/baileys/inbound/requireBaileysRawMessage";
import { inboundAddressingAsMsgLike } from "../../providers/baileys/inbound/baileysIdentityProbe";

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null)
  }
}));

function textInboundWithoutRaw(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "baileys",
    companyId: 10,
    whatsappId: 20,
    messageId: "NO_RAW_1",
    fromMe: false,
    timestamp: new Date("2024-01-01T12:00:00.000Z"),
    messageType: "conversation",
    body: "olá sem raw",
    pushName: "Cliente",
    isGroup: false,
    addressing: {
      remoteJid: "5511888777666@s.whatsapp.net",
      participant: "",
      senderPn: undefined,
      remoteJidAlt: undefined,
      participantPn: undefined
    },
    senderNumber: "5511888777666",
    quotedStanzaId: "QUOTED_ABC",
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
    ack: 1,
    editedMessageId: null,
    // explicitamente ausente — não fabricar proto
    ...partial
  };
}

describe("pipeline sem rawProviderMessage", () => {
  it("processInbound gate + classify + addressing + quoted lookup sem raw", async () => {
    const inbound = textInboundWithoutRaw();
    expect(inbound.rawProviderMessage).toBeUndefined();
    expect(tryGetBaileysRawMessage(inbound)).toBeNull();

    let sawBody: string | null = null;
    await processInboundWhatsAppMessage(inbound, {
      handleInboundMessage: async dto => {
        sawBody = dto.body;
        expect(dto.rawProviderMessage).toBeUndefined();

        const classification = classifyInboundMessageFromNormalized(
          dto,
          dto.body
        );
        expect(classification.messageType).toBe("text");
        expect(classification.hasText).toBe(true);

        const msgLike = inboundAddressingAsMsgLike(dto);
        expect(msgLike.key.remoteJid).toBe(dto.addressing.remoteJid);
        expect(msgLike.key.id).toBe(dto.messageId);
        expect(msgLike.key.fromMe).toBe(false);

        const quoted = await resolveQuotedMessageByStanzaId(dto.quotedStanzaId);
        expect(quoted).toBeNull();
      }
    });

    expect(sawBody).toBe("olá sem raw");
  });

  it("lista explicitamente o que ainda exige raw (sem esconder)", () => {
    const required = [
      ...OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE,
      ...PHASE5_BAILEYS_RAW_CONSUMERS
    ].join("\n");

    expect(required).toMatch(/BaileysMediaExtractor|downloadMedia/);
    expect(required).toMatch(/dataJson/);
    expect(required).toMatch(/n8n/i);
    expect(required).toMatch(/isValidMsg|lifecycle|groupMetadata/i);
  });

  it("mídia sem raw é sinalizada como operação que exige raw", () => {
    const mediaInbound = textInboundWithoutRaw({
      messageType: "imageMessage",
      media: {
        hasMedia: true,
        mimetype: "image/jpeg",
        filename: null,
        caption: "foto",
        isPtt: false
      }
    });
    expect(tryGetBaileysRawMessage(mediaInbound)).toBeNull();
    expect(mediaInbound.media.hasMedia).toBe(true);
    expect(
      OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE.some(op =>
        /downloadMedia|BaileysMediaExtractor/i.test(op)
      )
    ).toBe(true);
  });
});
