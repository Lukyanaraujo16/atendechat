/* eslint-disable import/first */
import fs from "fs";
import path from "path";
import { processInboundAutomation } from "../processInboundAutomation";
import { dispatchInboundTypebot } from "../../../../services/TypebotServices/dispatchInboundTypebot";
import { dispatchInboundQueueRouting } from "../../../../services/ChatbotServices/dispatchInboundQueueRouting";
import { dispatchInboundFlow } from "../../../../services/FlowBuilderService/dispatchInboundFlow";
import { NormalizedWhatsAppMessage } from "../../inbound/NormalizedWhatsAppMessage";

jest.mock(
  "../../../../services/TypebotServices/dispatchInboundTypebot",
  () => ({
    dispatchInboundTypebot: jest.fn()
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
    dispatchInboundFlow: jest.fn()
  })
);

const typebot = dispatchInboundTypebot as jest.Mock;
const queue = dispatchInboundQueueRouting as jest.Mock;
const flow = dispatchInboundFlow as jest.Mock;

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

const ticket = {
  id: 77,
  companyId: 1,
  whatsappId: 10,
  contactId: 5,
  isGroup: false,
  queueId: null,
  userId: null,
  chatbot: false,
  useIntegration: false,
  integrationId: null,
  promptId: null
};

describe("processInboundAutomation Flow 12.3-E", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    typebot.mockResolvedValue({ handled: false, halt: false });
    queue.mockResolvedValue({ handled: false, startedTypebot: false });
    flow.mockResolvedValue({ handled: false, startedFlow: false });
  });

  it("Typebot ativo tem prioridade sobre Flow", async () => {
    typebot.mockResolvedValue({
      handled: true,
      halt: true,
      reason: "session"
    });
    flow.mockResolvedValue({ handled: true, startedFlow: true });

    const result = await processInboundAutomation({
      inbound: inbound(),
      ticket,
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });

    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("typebot");
    expect(flow).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
  });

  it("Flow ativo não deixa queue routing responder também", async () => {
    flow.mockResolvedValue({
      handled: true,
      startedFlow: false,
      reason: "continuation"
    });

    const result = await processInboundAutomation({
      inbound: inbound(),
      ticket: {
        ...ticket,
        flowWebhook: true,
        lastFlowId: "wait1",
        flowStopped: "9"
      },
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });

    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("flow");
    expect(queue).not.toHaveBeenCalled();
  });

  it("Evolution inicia Flow e devolve consumer flow", async () => {
    flow.mockResolvedValue({
      handled: true,
      startedFlow: true,
      reason: "welcome"
    });

    const result = await processInboundAutomation({
      inbound: inbound(),
      ticket,
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1, integrationId: 3 },
      persistedMessageId: "M1"
    });

    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("flow");
    expect(result.startedFlow).toBe(true);
    expect(queue).not.toHaveBeenCalled();
  });

  it("queue routing com Flow startedFlow não chama flow dispatcher duas vezes", async () => {
    flow.mockResolvedValue({ handled: false, startedFlow: false });
    queue.mockResolvedValue({
      handled: true,
      startedTypebot: false,
      startedFlow: true,
      reason: "verify_queue"
    });

    const result = await processInboundAutomation({
      inbound: inbound(),
      ticket,
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });

    expect(flow).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("executed");
    if (result.status !== "executed") return;
    expect(result.consumer).toBe("queue_routing");
    expect(result.startedFlow).toBe(true);
  });

  it("reaction não executa Flow; revoke Evolution não entra na boundary", async () => {
    const reaction = await processInboundAutomation({
      inbound: inbound({
        kind: "reaction",
        reaction: { targetStanzaId: "X", emoji: "👍" }
      }),
      ticket,
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });
    expect(reaction.status).toBe("skipped");
    expect(flow).not.toHaveBeenCalled();

    const webhookSrc = fs.readFileSync(
      path.join(
        __dirname,
        "../../providers/evolution/inbound/processEvolutionWebhook.ts"
      ),
      "utf8"
    );
    expect(webhookSrc).not.toContain("processInboundAutomation");
  });

  it("listener Baileys não reexecuta Flow quando skipFlow", () => {
    const listenerSrc = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../services/WbotServices/wbotMessageListener.ts"
      ),
      "utf8"
    );
    expect(listenerSrc).toContain("skipFlow");
    expect(listenerSrc).toContain("if (skipFlow) {");
    expect(listenerSrc).toContain(
      "if (!skipFlow && !isNil(flow) && isWaitForInteraction"
    );
    expect(listenerSrc).toContain(
      "if (!skipFlow && !isNil(flow) && isQuestion"
    );
    expect(listenerSrc).toContain("legacyOpenAiNode: true");
  });

  it("grupo não executa Flow", async () => {
    const result = await processInboundAutomation({
      inbound: inbound({ isGroup: true }),
      ticket: { ...ticket, isGroup: true },
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });
    expect(result.status).toBe("skipped");
    expect(flow).not.toHaveBeenCalled();
  });

  it("fromMe não executa Flow", async () => {
    const result = await processInboundAutomation({
      inbound: inbound({ fromMe: true }),
      ticket,
      contact: { id: 5, companyId: 1 },
      whatsapp: { id: 10, companyId: 1 },
      persistedMessageId: "M1"
    });
    expect(result.status).toBe("skipped");
    expect(flow).not.toHaveBeenCalled();
  });
});
