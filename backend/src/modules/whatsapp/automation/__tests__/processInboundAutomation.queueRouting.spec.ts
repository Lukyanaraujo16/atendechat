/* eslint-disable import/first */
import { processInboundAutomation } from "../processInboundAutomation";
import { dispatchInboundQueueRouting } from "../../../../services/ChatbotServices/dispatchInboundQueueRouting";
import { NormalizedWhatsAppMessage } from "../../inbound/NormalizedWhatsAppMessage";

jest.mock(
  "../../../../services/TypebotServices/dispatchInboundTypebot",
  () => ({
    dispatchInboundTypebot: jest.fn().mockResolvedValue({
      handled: false,
      halt: false
    })
  })
);

jest.mock(
  "../../../../services/ChatbotServices/dispatchInboundQueueRouting",
  () => ({
    dispatchInboundQueueRouting: jest.fn()
  })
);

jest.mock(
  "../../../../services/FlowBuilderService/dispatchInboundFlow",
  () => ({
    dispatchInboundFlow: jest.fn().mockResolvedValue({
      handled: false,
      startedFlow: false
    })
  })
);

const dispatch = dispatchInboundQueueRouting as jest.Mock;

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

describe("processInboundAutomation queue routing 12.3-D", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Evolution privado elegível entra no Chatbot/Queue Routing core", async () => {
    dispatch.mockResolvedValue({
      handled: true,
      startedTypebot: false,
      reason: "verify_queue"
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
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("queue_routing");
    expect(result.halt).toBe(false);
    expect(result.context).toMatchObject({
      companyId: 1,
      ticketId: 77,
      whatsappId: 10,
      provider: "evolution"
    });
  });

  it("Typebot de fila marca startedTypebot para o adapter Baileys não duplicar", async () => {
    dispatch.mockResolvedValue({
      handled: true,
      startedTypebot: true,
      reason: "verify_queue"
    });

    const result = await processInboundAutomation({
      inbound: inbound({ body: "1" }),
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
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });

    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.startedTypebot).toBe(true);
  });

  it("reaction não entra no chatbot", async () => {
    const result = await processInboundAutomation({
      inbound: inbound({
        kind: "reaction",
        reaction: { targetStanzaId: "X", emoji: "👍" }
      }),
      ticket: {
        id: 77,
        companyId: 1,
        whatsappId: 10,
        contactId: 5,
        isGroup: false
      },
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("reaction");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
