/* eslint-disable import/first */
import {
  dispatchInboundFlow,
  DispatchInboundFlowDeps
} from "../dispatchInboundFlow";
import { InboundAutomationContext } from "../../../modules/whatsapp/automation/processInboundAutomation";
import { NormalizedWhatsAppMessage } from "../../../modules/whatsapp/inbound/NormalizedWhatsAppMessage";

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
      promptId: null,
      flowWebhook: false,
      lastFlowId: null,
      flowStopped: null
    },
    contact: { id: 5, companyId: 1 },
    whatsapp: { id: 10, companyId: 1, integrationId: 3 },
    persistedMessageId: "M1",
    ...partial
  };
}

function flowGraph(nodes: Array<{ id: string; type: string; data?: unknown }>) {
  return {
    flow: {
      nodes,
      connections: nodes.slice(0, -1).map((n, i) => ({
        source: n.id,
        target: nodes[i + 1].id
      }))
    }
  };
}

function makeTicket(partial: Record<string, unknown> = {}) {
  const ticket: Record<string, unknown> = {
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
    flowWebhook: false,
    lastFlowId: null,
    flowStopped: null,
    hashFlowId: null,
    dataWebhook: null,
    contact: { id: 5, name: "Ana", email: "a@b.c", number: "5511999998888" },
    update: jest.fn(async (data: Record<string, unknown>) => {
      Object.assign(ticket, data);
    }),
    ...partial
  };
  return ticket;
}

function baseDeps(
  ticket: ReturnType<typeof makeTicket>,
  extra: Partial<DispatchInboundFlowDeps> = {}
): DispatchInboundFlowDeps {
  return {
    loadTicket: jest.fn().mockResolvedValue(ticket),
    bypass: jest.fn().mockResolvedValue({ bypass: false, reason: null }),
    showIntegration: jest.fn().mockResolvedValue({
      id: 3,
      type: "flowbuilder",
      companyId: 1
    }),
    showWhatsapp: jest.fn().mockResolvedValue({
      id: 10,
      flowIdWelcome: 9,
      flowIdNotPhrase: null
    }),
    findCampaigns: jest.fn().mockResolvedValue([]),
    findFlow: jest.fn().mockResolvedValue(
      flowGraph([
        { id: "start", type: "start" },
        { id: "msg1", type: "message" }
      ])
    ),
    runActions: jest.fn().mockResolvedValue("ds"),
    updateTicket: jest.fn(async ({ ticketData }) => {
      Object.assign(ticket, ticketData);
    }),
    ...extra
  };
}

describe("dispatchInboundFlow 12.3-E", () => {
  it("grupo não executa Flow", async () => {
    const ticket = makeTicket({ isGroup: true });
    const deps = baseDeps(ticket);
    const result = await dispatchInboundFlow(
      ctx({
        inbound: inbound({ isGroup: true }),
        ticket: { ...ctx().ticket, isGroup: true }
      }),
      { deps }
    );
    expect(result.handled).toBe(false);
    expect(deps.runActions).not.toHaveBeenCalled();
  });

  it("fromMe não executa Flow", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket);
    const result = await dispatchInboundFlow(
      ctx({ inbound: inbound({ fromMe: true }) }),
      { deps }
    );
    expect(result.handled).toBe(false);
    expect(deps.runActions).not.toHaveBeenCalled();
  });

  it("inicia Flow welcome da conexão sem WASocket", async () => {
    const ticket = makeTicket();
    const runActions = jest.fn().mockResolvedValue("ds");
    const deps = baseDeps(ticket, { runActions });
    const result = await dispatchInboundFlow(ctx(), { deps });
    expect(result.handled).toBe(true);
    expect(result.startedFlow).toBe(true);
    expect(runActions).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappId: 10,
        idFlowDb: 9,
        companyId: 1,
        nextStage: "msg1",
        idTicket: 77,
        inboundHint: expect.objectContaining({
          remoteJid: "5511999998888@s.whatsapp.net",
          body: "oi"
        })
      })
    );
    const call = runActions.mock.calls[0][0];
    expect(call).not.toHaveProperty("wbot");
    expect(JSON.stringify(call)).not.toMatch(/WASocket|getWbot|proto/);
  });

  it("forceStart pela fila inicia o Flow da conexão", async () => {
    const ticket = makeTicket({ queueId: 4, integrationId: 8 });
    const runActions = jest.fn().mockResolvedValue("ds");
    const deps = baseDeps(ticket, {
      runActions,
      showIntegration: jest.fn().mockResolvedValue({
        id: 8,
        type: "flowbuilder",
        companyId: 1
      })
    });
    const result = await dispatchInboundFlow(
      ctx({
        ticket: { ...ctx().ticket, queueId: 4, integrationId: 8 }
      }),
      { forceStart: true, deps }
    );
    expect(result.handled).toBe(true);
    expect(result.startedFlow).toBe(true);
    expect(runActions).toHaveBeenCalled();
  });

  it("waitForInteraction pausa e o próximo inbound continua o mesmo Flow", async () => {
    const ticket = makeTicket({
      flowWebhook: true,
      flowStopped: "9",
      lastFlowId: "wait1"
    });
    const runActions = jest.fn().mockResolvedValue("ds");
    const findFlow = jest.fn().mockResolvedValue(
      flowGraph([
        { id: "start", type: "start" },
        { id: "wait1", type: "waitForInteraction" },
        { id: "msg2", type: "message" }
      ])
    );
    const deps = baseDeps(ticket, { runActions, findFlow });
    const first = await dispatchInboundFlow(
      ctx({
        ticket: {
          ...ctx().ticket,
          flowWebhook: true,
          flowStopped: "9",
          lastFlowId: "wait1"
        }
      }),
      { deps }
    );
    expect(first.handled).toBe(true);
    expect(first.startedFlow).toBe(false);
    expect(first.reason).toBe("continuation");
    expect(ticket.lastFlowId).toBe("msg2");
    expect(runActions).toHaveBeenCalledWith(
      expect.objectContaining({
        idFlowDb: 9,
        nextStage: "msg2",
        pressKey: null
      })
    );
    expect(findFlow).toHaveBeenCalledWith(9, 1);
  });

  it("question grava variável e continua sem reiniciar", async () => {
    const ticket = makeTicket({
      flowStopped: "9",
      lastFlowId: "q1",
      dataWebhook: { variables: { nome: "Ana" } }
    });
    const runActions = jest.fn().mockResolvedValue("ds");
    const findFlow = jest.fn().mockResolvedValue({
      flow: {
        nodes: [
          {
            id: "q1",
            type: "question",
            data: { typebotIntegration: { answerKey: "cidade" } }
          },
          { id: "msg2", type: "message" }
        ],
        connections: [{ source: "q1", target: "msg2" }]
      }
    });
    const deps = baseDeps(ticket, { runActions, findFlow });
    const result = await dispatchInboundFlow(
      ctx({
        inbound: inbound({ body: "Recife" }),
        ticket: {
          ...ctx().ticket,
          flowStopped: "9",
          lastFlowId: "q1"
        }
      }),
      { deps }
    );
    expect(result.handled).toBe(true);
    expect(result.startedFlow).toBe(false);
    expect(ticket.lastFlowId).toBe("msg2");
    expect(ticket.dataWebhook).toEqual({
      variables: { nome: "Ana", cidade: "Recife" }
    });
    expect(runActions).toHaveBeenCalledTimes(1);
    expect(runActions).toHaveBeenCalledWith(
      expect.objectContaining({ nextStage: "msg2", idFlowDb: 9 })
    );
  });

  it("menu textual continua com pressKey = body", async () => {
    const ticket = makeTicket({
      flowWebhook: true,
      flowStopped: "9",
      lastFlowId: "menu1",
      hashFlowId: "h1",
      dataWebhook: { variables: {} }
    });
    const runActions = jest.fn().mockResolvedValue("ds");
    const findFlow = jest.fn().mockResolvedValue({
      flow: {
        nodes: [{ id: "menu1", type: "menu" }],
        connections: []
      }
    });
    const deps = baseDeps(ticket, { runActions, findFlow });
    await dispatchInboundFlow(
      ctx({
        inbound: inbound({ body: "1" }),
        ticket: {
          ...ctx().ticket,
          flowWebhook: true,
          flowStopped: "9",
          lastFlowId: "menu1",
          hashFlowId: "h1",
          dataWebhook: { variables: {} }
        }
      }),
      { deps }
    );
    expect(runActions).toHaveBeenCalledWith(
      expect.objectContaining({
        pressKey: "1",
        nextStage: "menu1",
        hashWebhookId: "h1"
      })
    );
  });

  it("OpenAI em Evolution é deferido sem runActions", async () => {
    const ticket = makeTicket({
      flowWebhook: true,
      flowStopped: "9",
      lastFlowId: "ai1"
    });
    const runActions = jest.fn();
    const findFlow = jest.fn().mockResolvedValue({
      flow: {
        nodes: [{ id: "ai1", type: "openai" }],
        connections: []
      }
    });
    const result = await dispatchInboundFlow(
      ctx({
        ticket: {
          ...ctx().ticket,
          flowWebhook: true,
          flowStopped: "9",
          lastFlowId: "ai1"
        }
      }),
      { deps: baseDeps(ticket, { runActions, findFlow }) }
    );
    expect(result.handled).toBe(true);
    expect(result.deferredOpenAi).toBe(true);
    expect(runActions).not.toHaveBeenCalled();
  });

  it("OpenAI legado Baileys devolve deferredOpenAi para o listener", async () => {
    const ticket = makeTicket({
      flowWebhook: true,
      flowStopped: "9",
      lastFlowId: "ai1"
    });
    const runActions = jest.fn();
    const findFlow = jest.fn().mockResolvedValue({
      flow: {
        nodes: [{ id: "ai1", type: "openai" }],
        connections: []
      }
    });
    const result = await dispatchInboundFlow(
      ctx({
        ticket: {
          ...ctx().ticket,
          flowWebhook: true,
          flowStopped: "9",
          lastFlowId: "ai1"
        }
      }),
      {
        legacyOpenAiNode: true,
        deps: baseDeps(ticket, { runActions, findFlow })
      }
    );
    expect(result.handled).toBe(true);
    expect(result.deferredOpenAi).toBe(true);
    expect(result.reason).toBe("openai_legacy");
    expect(runActions).not.toHaveBeenCalled();
  });

  it("tenant isolation: Flow é buscado com company_id do inbound", async () => {
    const ticket = makeTicket({ companyId: 42 });
    const findFlow = jest.fn().mockResolvedValue(null);
    const loadTicket = jest.fn().mockResolvedValue(ticket);
    const result = await dispatchInboundFlow(
      ctx({
        inbound: inbound({ companyId: 42, whatsappId: 9 }),
        ticket: { ...ctx().ticket, companyId: 42, whatsappId: 9 },
        whatsapp: { id: 9, companyId: 42, integrationId: 3 }
      }),
      {
        deps: {
          ...baseDeps(ticket, { findFlow, loadTicket }),
          showWhatsapp: jest.fn().mockResolvedValue({
            id: 9,
            flowIdWelcome: 88,
            flowIdNotPhrase: null
          })
        }
      }
    );
    expect(loadTicket).toHaveBeenCalledWith(77, 42);
    expect(findFlow).toHaveBeenCalledWith(88, 42);
    expect(result.handled).toBe(false);
  });

  it("campanha por frase tem prioridade sobre welcome", async () => {
    const ticket = makeTicket();
    const runActions = jest.fn().mockResolvedValue("ds");
    const findFlow = jest.fn().mockResolvedValueOnce(
      flowGraph([
        { id: "start", type: "start" },
        { id: "camp", type: "message" }
      ])
    );
    const deps = baseDeps(ticket, {
      runActions,
      findFlow,
      findCampaigns: jest.fn().mockResolvedValue([{ phrase: "oi", flowId: 22 }])
    });
    const result = await dispatchInboundFlow(ctx(), { deps });
    expect(result.reason).toBe("campaign");
    expect(runActions).toHaveBeenCalledWith(
      expect.objectContaining({ idFlowDb: 22, nextStage: "camp" })
    );
  });
});
