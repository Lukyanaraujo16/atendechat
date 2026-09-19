import { processInboundAutomation } from "../processInboundAutomation";
import { dispatchInboundTypebot } from "../../../../services/TypebotServices/dispatchInboundTypebot";
import { NormalizedWhatsAppMessage } from "../../inbound/NormalizedWhatsAppMessage";

jest.mock(
  "../../../../services/TypebotServices/dispatchInboundTypebot",
  () => ({
    dispatchInboundTypebot: jest.fn()
  })
);

const dispatch = dispatchInboundTypebot as jest.Mock;

function inbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "evolution",
    companyId: 1,
    whatsappId: 10,
    messageId: "M1",
    fromMe: false,
    timestamp: null,
    messageType: "conversation",
    body: "oi",
    pushName: "Ana",
    isGroup: false,
    addressing: {
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: ""
    },
    senderNumber: "5511999998888",
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
    rawProviderMessage: null,
    ...partial
  };
}

describe("processInboundAutomation Typebot 12.3-C", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Evolution privado executa Typebot na boundary", async () => {
    dispatch.mockResolvedValue({
      handled: true,
      halt: true,
      reason: "connection_start"
    });

    const result = await processInboundAutomation({
      inbound: inbound(),
      ticket: {
        id: 77,
        companyId: 1,
        whatsappId: 10,
        contactId: 5,
        isGroup: false,
        queueId: null,
        userId: null
      },
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1, integrationId: 9 },
      persistedMessageId: "M1"
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("typebot");
    expect(result.halt).toBe(true);
    expect(result.context).toMatchObject({
      companyId: 1,
      ticketId: 77,
      whatsappId: 10,
      contactId: 5,
      provider: "evolution"
    });
  });

  it("grupo não chega a executar Typebot", async () => {
    const result = await processInboundAutomation({
      inbound: inbound({ isGroup: true }),
      ticket: {
        id: 77,
        companyId: 1,
        whatsappId: 10,
        contactId: 5,
        isGroup: true
      },
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1, integrationId: 9 },
      persistedMessageId: "M1"
    });
    expect(result.status).toBe("skipped");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
