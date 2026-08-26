import {
  OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE,
  processInboundWhatsAppMessage
} from "../ProcessInboundWhatsAppMessage";
import { NormalizedWhatsAppMessage } from "../NormalizedWhatsAppMessage";

function inbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "baileys",
    companyId: 1,
    whatsappId: 2,
    messageId: "M1",
    fromMe: false,
    timestamp: null,
    messageType: "conversation",
    body: "oi",
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
    rawProviderMessage: { key: { id: "M1" } },
    ...partial
  };
}

describe("processInboundWhatsAppMessage", () => {
  it("delega ao handler de domínio com o DTO normalizado", async () => {
    const received: NormalizedWhatsAppMessage[] = [];
    const msg = inbound();

    await processInboundWhatsAppMessage(msg, {
      handleInboundMessage: async normalized => {
        received.push(normalized);
      }
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(msg);
    expect(received[0].rawProviderMessage).toBe(msg.rawProviderMessage);
  });

  it("aceita ausência de rawProviderMessage no gate (Fase 4)", async () => {
    const received: NormalizedWhatsAppMessage[] = [];
    await processInboundWhatsAppMessage(
      inbound({ rawProviderMessage: undefined }),
      {
        handleInboundMessage: async normalized => {
          received.push(normalized);
        }
      }
    );
    expect(received).toHaveLength(1);
    expect(received[0].rawProviderMessage).toBeUndefined();
  });

  it("aceita rawProviderMessage null no gate (Fase 4)", async () => {
    const received: NormalizedWhatsAppMessage[] = [];
    await processInboundWhatsAppMessage(inbound({ rawProviderMessage: null }), {
      handleInboundMessage: async normalized => {
        received.push(normalized);
      }
    });
    expect(received).toHaveLength(1);
    expect(received[0].rawProviderMessage).toBeNull();
  });

  it("rejeita provider diferente de baileys", async () => {
    await expect(
      processInboundWhatsAppMessage(
        inbound({ provider: "unknown-provider" as never }),
        { handleInboundMessage: async () => undefined }
      )
    ).rejects.toThrow(/baileys/);
  });

  it("documenta operações que ainda exigem raw", () => {
    expect(OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE.length).toBeGreaterThan(0);
    expect(OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE.join(" ")).toMatch(
      /downloadMedia|dataJson|n8n/i
    );
  });
});
