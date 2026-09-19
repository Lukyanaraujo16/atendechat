/* eslint-disable import/first */
import fs from "fs";
import path from "path";

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
    dispatchInboundQueueRouting: jest.fn().mockResolvedValue({
      handled: false,
      startedTypebot: false
    })
  })
);

import {
  classifyIntendedAutomationConsumers,
  evaluateInboundAutomationEligibility,
  processInboundAutomation,
  SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS,
  InboundAutomationContext
} from "../processInboundAutomation";
import { NormalizedWhatsAppMessage } from "../../inbound/NormalizedWhatsAppMessage";

function inbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "baileys",
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

function ctx(
  partial: Partial<InboundAutomationContext> = {}
): InboundAutomationContext {
  return {
    inbound: inbound(),
    ticket: {
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
    },
    contact: { id: 5, companyId: 1 },
    whatsapp: {
      id: 10,
      companyId: 1,
      integrationId: null,
      promptId: null
    },
    persistedMessageId: "M1",
    ...partial
  };
}

describe("processInboundAutomation 12.3-B", () => {
  it("Baileys inbound privado elegível chega ao domínio (ready)", async () => {
    const result = await processInboundAutomation(ctx());
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.companyId).toBe(1);
    expect(result.context.whatsappId).toBe(10);
    expect(result.context.ticketId).toBe(77);
    expect(result.context.contactId).toBe(5);
    expect(result.context.provider).toBe("baileys");
    expect(result.socketBoundConsumers).toEqual(
      SOCKET_BOUND_INBOUND_AUTOMATION_CONSUMERS
    );
  });

  it("Evolution inbound privado elegível chega à mesma boundary", async () => {
    const result = await processInboundAutomation(
      ctx({ inbound: inbound({ provider: "evolution" }) })
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.provider).toBe("evolution");
    expect(result.context.ticketId).toBe(77);
    expect(result.context.whatsappId).toBe(10);
  });

  it("grupo não ativa automação (política atual)", async () => {
    const result = await processInboundAutomation(
      ctx({
        inbound: inbound({ provider: "evolution", isGroup: true }),
        ticket: {
          id: 77,
          companyId: 1,
          whatsappId: 10,
          contactId: 5,
          isGroup: true
        }
      })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("group");
  });

  it("fromMe não gera automação indevida", async () => {
    const result = await processInboundAutomation(
      ctx({ inbound: inbound({ fromMe: true }) })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("fromMe");
  });

  it("reaction não entra em automação", async () => {
    const result = await processInboundAutomation(
      ctx({
        inbound: inbound({
          kind: "reaction",
          reaction: { targetStanzaId: "X", emoji: "👍" }
        })
      })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("reaction");
  });

  it("tenant/company/ticket/whatsapp corretos chegam ao runner", async () => {
    const result = await processInboundAutomation(
      ctx({
        inbound: inbound({
          provider: "evolution",
          companyId: 42,
          whatsappId: 9,
          messageId: "EVO-9"
        }),
        ticket: {
          id: 100,
          companyId: 42,
          whatsappId: 9,
          contactId: 3,
          isGroup: false
        },
        contact: { id: 3, companyId: 42 },
        whatsapp: { id: 9, companyId: 42 },
        persistedMessageId: "EVO-9"
      })
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context).toMatchObject({
      companyId: 42,
      whatsappId: 9,
      ticketId: 100,
      contactId: 3,
      messageId: "EVO-9",
      persistedMessageId: "EVO-9",
      provider: "evolution"
    });
  });

  it("company mismatch é skip explícito", async () => {
    const result = await processInboundAutomation(
      ctx({
        ticket: {
          id: 77,
          companyId: 99,
          whatsappId: 10,
          contactId: 5,
          isGroup: false
        }
      })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("tenant_mismatch");
  });

  it("whatsapp mismatch é skip explícito", async () => {
    const result = await processInboundAutomation(
      ctx({
        ticket: {
          id: 77,
          companyId: 1,
          whatsappId: 999,
          contactId: 5,
          isGroup: false
        }
      })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("whatsapp_mismatch");
  });

  it("Baileys executa consumidores socket-bound via capability do adapter", async () => {
    const runSocketBoundConsumers = jest.fn().mockResolvedValue(undefined);
    const result = await processInboundAutomation(ctx(), {
      runSocketBoundConsumers
    });
    expect(runSocketBoundConsumers).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("executed_socket_bound");
  });

  it("Evolution sem capability não executa consumidores socket-bound", async () => {
    const runSocketBoundConsumers = jest.fn();
    const result = await processInboundAutomation(
      ctx({ inbound: inbound({ provider: "evolution" }) })
    );
    expect(runSocketBoundConsumers).not.toHaveBeenCalled();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.socketBoundConsumers.length).toBeGreaterThan(0);
    expect(result.socketBoundConsumers).toEqual(
      expect.arrayContaining([
        "handleMessageIntegration",
        "ActionsWebhookService",
        "handleOpenAi"
      ])
    );
    expect(result.socketBoundConsumers).not.toEqual(
      expect.arrayContaining(["verifyQueue", "handleChartbot"])
    );
  });

  it("grupo não dispara capability Baileys", async () => {
    const runSocketBoundConsumers = jest.fn();
    const result = await processInboundAutomation(
      ctx({
        inbound: inbound({ isGroup: true }),
        ticket: {
          id: 77,
          companyId: 1,
          whatsappId: 10,
          contactId: 5,
          isGroup: true
        }
      }),
      { runSocketBoundConsumers }
    );
    expect(runSocketBoundConsumers).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped");
  });

  it("fromMe não dispara capability Baileys", async () => {
    const runSocketBoundConsumers = jest.fn();
    await processInboundAutomation(
      ctx({ inbound: inbound({ fromMe: true }) }),
      { runSocketBoundConsumers }
    );
    expect(runSocketBoundConsumers).not.toHaveBeenCalled();
  });

  it("mensagem não persistida não entra", async () => {
    const result = await processInboundAutomation(
      ctx({ persistedMessageId: "" })
    );
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toBe("not_persisted");
  });

  it("classifica verifyQueue quando conexão sem fila/integração", () => {
    const consumers = classifyIntendedAutomationConsumers(
      ctx().ticket,
      ctx().whatsapp
    );
    expect(consumers).toContain("verifyQueue");
  });

  it("evaluateInboundAutomationEligibility é provider-agnostic", () => {
    expect(evaluateInboundAutomationEligibility(ctx()).ok).toBe(true);
    expect(
      evaluateInboundAutomationEligibility(
        ctx({ inbound: inbound({ provider: "evolution" }) })
      ).ok
    ).toBe(true);
  });
});

describe("12.3-B static coupling", () => {
  const coreSrc = fs.readFileSync(
    path.join(__dirname, "../processInboundAutomation.ts"),
    "utf8"
  );

  it("core comum não acopla Baileys", () => {
    expect(coreSrc).not.toMatch(/from ["']@whiskeysockets\/baileys["']/);
    expect(coreSrc).not.toMatch(/GetTicketWbot/);
    expect(coreSrc).not.toMatch(/GetWhatsappWbot/);
    expect(coreSrc).not.toMatch(/wrapBaileysSession/);
    expect(coreSrc).not.toMatch(/\bgetWbot\s*\(/);
    expect(coreSrc).not.toMatch(/\bWASocket\b/);
    expect(coreSrc).not.toMatch(/\bproto\./);
  });

  it("handleMessage Baileys chama a boundary após persistir", () => {
    const listenerSrc = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../services/WbotServices/wbotMessageListener.ts"
      ),
      "utf8"
    );
    expect(listenerSrc).toContain("processInboundAutomation");
    const persistMarker = "scheduleAiAgentDryRunFromInbound";
    const gateIdx = listenerSrc.indexOf("await processInboundAutomation");
    const persistIdx = listenerSrc.indexOf(persistMarker);
    const chatbotIdx = listenerSrc.lastIndexOf("handleChartbot");
    expect(persistIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(persistIdx);
    expect(chatbotIdx).toBeGreaterThan(gateIdx);
    expect(listenerSrc).toContain("skipQueueRouting");
    expect(listenerSrc).toContain("queueMenuRender");
  });
});
