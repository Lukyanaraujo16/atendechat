/* eslint-disable import/first */
jest.mock("../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined)
}));

import fs from "fs";
import path from "path";
import {
  dispatchInboundQueueRouting,
  DispatchInboundQueueRoutingDeps
} from "../dispatchInboundQueueRouting";
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
      promptId: null
    },
    contact: { id: 5, companyId: 1 },
    whatsapp: { id: 10, companyId: 1 },
    persistedMessageId: "M1",
    ...partial
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
    promptId: null,
    amountUsedBotQueues: 0,
    contact: { id: 5, name: "Ana", companyId: 1, number: "5511999998888" },
    update: jest.fn(async (data: Record<string, unknown>) => {
      Object.assign(ticket, data);
    }),
    reload: jest.fn(async () => ticket),
    ...partial
  };
  return ticket;
}

function settings(partial: Record<string, unknown> = {}) {
  return {
    autoMessages: { sendGreetingMessageOneQueues: "disabled" },
    chatBotType: "text",
    scheduleType: "disabled",
    ...partial
  };
}

function tracking() {
  return {
    chatbotAt: null,
    update: jest.fn().mockResolvedValue(undefined)
  };
}

function baseDeps(
  ticket: ReturnType<typeof makeTicket>,
  extra: Partial<DispatchInboundQueueRoutingDeps> = {}
): DispatchInboundQueueRoutingDeps {
  return {
    loadTicket: jest.fn().mockResolvedValue(ticket),
    showWhatsapp: jest.fn().mockResolvedValue({
      id: 10,
      companyId: 1,
      greetingMessage: "Olá, escolha uma fila",
      maxUseBotQueues: 0,
      timeUseBotQueues: "0",
      queues: [
        { id: 1, name: "Comercial", options: [] },
        { id: 2, name: "Suporte", options: [] }
      ]
    }),
    sendText: jest.fn().mockResolvedValue(undefined),
    updateTicket: jest.fn(async ({ ticketData }) => {
      Object.assign(ticket, ticketData);
    }),
    bypass: jest.fn().mockResolvedValue({ bypass: false, reason: null }),
    resolveSettings: jest.fn().mockResolvedValue(settings()),
    findTracking: jest.fn().mockResolvedValue(tracking()),
    runTypebot: jest.fn().mockResolvedValue(undefined),
    showIntegration: jest.fn(),
    ...extra
  };
}

describe("dispatchInboundQueueRouting 12.3-D", () => {
  it("Evolution privado elegível envia greeting e lista textual de filas", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket);
    const result = await dispatchInboundQueueRouting(ctx(), { deps });

    expect(result.handled).toBe(true);
    expect(deps.sendText).toHaveBeenCalledTimes(1);
    const text = (deps.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(text).toContain("Olá, escolha uma fila");
    expect(text).toContain("*[ 1 ]* - Comercial");
    expect(text).toContain("*[ 2 ]* - Suporte");
    expect(
      (deps.sendText as jest.Mock).mock.calls[0][2].addressing.remoteJid
    ).toBe("5511999998888@s.whatsapp.net");
  });

  it("usuário escolhe fila válida e ticket.queueId é atualizado", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket);
    const result = await dispatchInboundQueueRouting(
      ctx({ inbound: inbound({ body: "1" }) }),
      { deps }
    );

    expect(result.handled).toBe(true);
    expect(deps.updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: expect.objectContaining({ queueId: 1, chatbot: false }),
        ticketId: 77,
        companyId: 1
      })
    );
    expect(ticket.queueId).toBe(1);
  });

  it("escolha inválida reenvia o menu textual", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket);
    await dispatchInboundQueueRouting(
      ctx({ inbound: inbound({ body: "99" }) }),
      { deps }
    );
    const text = (deps.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(text).toContain("*[ 1 ]* - Comercial");
    expect(deps.updateTicket).not.toHaveBeenCalled();
  });

  it("queueOption/submenu textual funciona e persiste queueOptionId", async () => {
    const ticket = makeTicket({
      queueId: 1,
      chatbot: true,
      queueOptionId: null
    });
    const option = { id: 11, option: "1", title: "Vendas", message: "Sub" };
    const child = { id: 12, option: "1", title: "Novo", message: "ok" };
    const deps = baseDeps(ticket, {
      findQueueWithRootOptions: jest.fn().mockResolvedValue({
        id: 1,
        companyId: 1,
        greetingMessage: "Opções da fila",
        options: [option]
      }),
      findQueueOptions: jest.fn().mockResolvedValue([child]),
      countQueueOptions: jest.fn().mockResolvedValue(1),
      findQueueOptionByPk: jest.fn().mockResolvedValue(option)
    });

    await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ body: "1" }),
        ticket: { ...ctx().ticket, queueId: 1, chatbot: true }
      }),
      { deps }
    );

    expect(ticket.queueOptionId).toBe(11);
    expect(deps.sendText).toHaveBeenCalled();
    const text = (deps.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(text).toContain("*[ 1 ]* - Novo");
    expect(text).toContain("*[ 0 ]* - Menu anterior");
    expect(text).toContain("*[ # ]* - Menu inicial");
  });

  it("comando # reseta fila e reapresenta o menu", async () => {
    const ticket = makeTicket({ queueId: 1, chatbot: true, queueOptionId: 11 });
    const deps = baseDeps(ticket);
    const result = await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ body: "#" }),
        ticket: {
          ...ctx().ticket,
          queueId: 1,
          chatbot: true,
          queueOptionId: 11
        }
      }),
      { deps }
    );

    expect(result.reason).toBe("hash_reset");
    expect(deps.updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: expect.objectContaining({
          queueId: null,
          queueOptionId: null,
          chatbot: false
        })
      })
    );
    const text = (deps.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(text).toContain("*[ 1 ]* - Comercial");
  });

  it("comando 0 volta ao menu anterior", async () => {
    const ticket = makeTicket({
      queueId: 1,
      chatbot: true,
      queueOptionId: 12
    });
    const deps = baseDeps(ticket, {
      findQueueWithRootOptions: jest.fn().mockResolvedValue({
        id: 1,
        greetingMessage: "Fila",
        options: [{ id: 11, option: "1", title: "A" }]
      }),
      findQueueOptionByPk: jest.fn().mockResolvedValue({
        id: 12,
        parentId: 11,
        message: "Atual"
      }),
      findQueueOptions: jest
        .fn()
        .mockResolvedValue([
          { id: 12, option: "1", title: "Novo", parentId: 11 }
        ]),
      countQueueOptions: jest.fn().mockResolvedValue(1)
    });

    await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ body: "0" }),
        ticket: {
          ...ctx().ticket,
          queueId: 1,
          chatbot: true,
          queueOptionId: 12
        }
      }),
      { deps }
    );

    expect(ticket.update).toHaveBeenCalledWith({ queueOptionId: 11 });
  });

  it("Typebot configurado na fila inicia após seleção (scheduleType=queue)", async () => {
    const ticket = makeTicket();
    const runTypebot = jest.fn().mockResolvedValue(undefined);
    const deps = baseDeps(ticket, {
      runTypebot,
      showIntegration: jest.fn().mockResolvedValue({
        id: 9,
        type: "typebot",
        companyId: 1
      }),
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "Oi",
        maxUseBotQueues: 0,
        timeUseBotQueues: "0",
        queues: [
          {
            id: 1,
            name: "Comercial",
            integrationId: 9,
            options: [],
            greetingMessage: "Fila comercial"
          },
          { id: 2, name: "Suporte", options: [] }
        ]
      }),
      resolveSettings: jest
        .fn()
        .mockResolvedValue(settings({ scheduleType: "queue" })),
      findQueue: jest.fn().mockResolvedValue({
        id: 1,
        companyId: 1,
        outOfHoursMessage: "",
        schedules: []
      })
    });

    const result = await dispatchInboundQueueRouting(
      ctx({ inbound: inbound({ body: "1", provider: "evolution" }) }),
      { deps }
    );

    expect(result.startedTypebot).toBe(true);
    expect(runTypebot).toHaveBeenCalledTimes(1);
    const req = runTypebot.mock.calls[0][0];
    expect(req.typebot.id).toBe(9);
    expect(req.inbound.body).toBe("1");
    expect(req.ticket.companyId).toBe(1);
    expect(ticket.useIntegration).toBe(true);
    expect(ticket.integrationId).toBe(9);
  });

  it("fila única com Typebot inicia sem WASocket", async () => {
    const ticket = makeTicket();
    const runTypebot = jest.fn().mockResolvedValue(undefined);
    const deps = baseDeps(ticket, {
      runTypebot,
      showIntegration: jest.fn().mockResolvedValue({
        id: 9,
        type: "typebot",
        companyId: 1
      }),
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "Bem-vindo",
        maxUseBotQueues: 0,
        timeUseBotQueues: "0",
        queues: [{ id: 4, name: "Única", integrationId: 9, options: [] }]
      })
    });

    const result = await dispatchInboundQueueRouting(ctx(), { deps });
    expect(result.startedTypebot).toBe(true);
    expect(runTypebot).toHaveBeenCalledTimes(1);
    expect(deps.updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: expect.objectContaining({ queueId: 4, status: "pending" })
      })
    );
  });

  it("Flow na fila inicia o executor provider-neutral sem Typebot", async () => {
    const ticket = makeTicket();
    const runTypebot = jest.fn();
    const dispatchFlow = jest.fn().mockResolvedValue({
      handled: true,
      startedFlow: true,
      reason: "queue_start"
    });
    const deps = baseDeps(ticket, {
      runTypebot,
      dispatchFlow,
      showIntegration: jest.fn().mockResolvedValue({
        id: 8,
        type: "flowbuilder",
        companyId: 1
      }),
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "",
        queues: [{ id: 4, name: "Única", integrationId: 8, options: [] }]
      })
    });

    const result = await dispatchInboundQueueRouting(ctx(), { deps });
    expect(result.handled).toBe(true);
    expect(result.startedFlow).toBe(true);
    expect(result.deferredIntegration).toBeUndefined();
    expect(runTypebot).not.toHaveBeenCalled();
    expect(dispatchFlow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ forceStart: true })
    );
    expect(ticket.useIntegration).toBe(true);
    expect(ticket.integrationId).toBe(8);
  });

  it("OpenAI legado na fila é deferido sem crash", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket, {
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "",
        queues: [{ id: 4, name: "Única", promptId: 15, options: [] }]
      })
    });

    const result = await dispatchInboundQueueRouting(ctx(), { deps });
    expect(result.deferredIntegration).toBe("openai");
    expect(ticket.useIntegration).toBe(false);
  });

  it("grupo não executa chatbot", async () => {
    const ticket = makeTicket({ isGroup: true });
    const deps = baseDeps(ticket);
    const result = await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ isGroup: true }),
        ticket: { ...ctx().ticket, isGroup: true }
      }),
      { deps }
    );
    expect(result.handled).toBe(false);
    expect(deps.sendText).not.toHaveBeenCalled();
    expect(deps.showWhatsapp).not.toHaveBeenCalled();
  });

  it("fromMe não executa chatbot", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket);
    const result = await dispatchInboundQueueRouting(
      ctx({ inbound: inbound({ fromMe: true }) }),
      { deps }
    );
    expect(result.handled).toBe(false);
    expect(deps.sendText).not.toHaveBeenCalled();
  });

  it("tenant isolation: whatsapp/ticket/integration no companyId do inbound", async () => {
    const ticket = makeTicket({ companyId: 42, whatsappId: 9 });
    const showIntegration = jest.fn().mockResolvedValue({
      id: 9,
      type: "typebot",
      companyId: 42
    });
    const deps = baseDeps(ticket, {
      showIntegration,
      runTypebot: jest.fn().mockResolvedValue(undefined),
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "",
        queues: [{ id: 4, name: "Única", integrationId: 9, options: [] }]
      })
    });

    await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ companyId: 42, whatsappId: 9 }),
        ticket: {
          ...ctx().ticket,
          companyId: 42,
          whatsappId: 9
        },
        contact: { id: 5, companyId: 42 },
        whatsapp: { id: 9, companyId: 42 }
      }),
      { deps }
    );

    expect(deps.loadTicket).toHaveBeenCalledWith(77, 42);
    expect(deps.showWhatsapp).toHaveBeenCalledWith(9, 42);
    expect(showIntegration).toHaveBeenCalledWith(9, 42);
  });

  it("ticket de outro tenant não é carregado", async () => {
    const deps = baseDeps(makeTicket(), {
      loadTicket: jest.fn().mockResolvedValue(null)
    });
    const result = await dispatchInboundQueueRouting(ctx(), { deps });
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("ticket_not_found");
    expect(deps.sendText).not.toHaveBeenCalled();
  });

  it("Baileys buttons/list usam capability; Evolution cai no texto", async () => {
    const ticket = makeTicket({ queueId: 1, chatbot: true });
    const sendInteractiveMenu = jest.fn().mockResolvedValue(undefined);
    const option = { id: 11, option: "1", title: "Vendas" };
    const deps = baseDeps(ticket, {
      findQueueWithRootOptions: jest.fn().mockResolvedValue({
        id: 1,
        greetingMessage: "Escolha",
        options: [option]
      }),
      findQueueOptions: jest.fn().mockResolvedValue([option]),
      resolveSettings: jest
        .fn()
        .mockResolvedValue(settings({ chatBotType: "button" }))
    });

    await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ body: "x", provider: "baileys" }),
        ticket: { ...ctx().ticket, queueId: 1, chatbot: true }
      }),
      {
        deps,
        menuRender: { sendInteractiveMenu }
      }
    );
    expect(sendInteractiveMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "button",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "1", title: "Vendas" })
        ])
      })
    );

    sendInteractiveMenu.mockClear();
    (deps.sendText as jest.Mock).mockClear();
    await dispatchInboundQueueRouting(
      ctx({
        inbound: inbound({ body: "x", provider: "evolution" }),
        ticket: { ...ctx().ticket, queueId: 1, chatbot: true }
      }),
      { deps }
    );
    expect(sendInteractiveMenu).not.toHaveBeenCalled();
    expect(deps.sendText).toHaveBeenCalled();
    const text = (deps.sendText as jest.Mock).mock.calls[0][1] as string;
    expect(text).toContain("*[ 1 ]* - Vendas");
  });

  it("greeting de fila única respeita sendGreetingMessageOneQueues", async () => {
    const ticket = makeTicket();
    const deps = baseDeps(ticket, {
      showWhatsapp: jest.fn().mockResolvedValue({
        greetingMessage: "Bem-vindo à central",
        queues: [{ id: 4, name: "Única", options: [] }]
      }),
      resolveSettings: jest.fn().mockResolvedValue(
        settings({
          autoMessages: { sendGreetingMessageOneQueues: "enabled" }
        })
      )
    });
    await dispatchInboundQueueRouting(ctx(), { deps });
    expect(deps.sendText).toHaveBeenCalledWith(
      ticket,
      "Bem-vindo à central",
      expect.anything()
    );
  });
});

describe("12.3-D static coupling", () => {
  const coreDir = path.join(__dirname, "..");
  const files = [
    "dispatchInboundQueueRouting.ts",
    "queueMenuText.ts",
    "sendQueueRoutingText.ts",
    "releaseTicketFromChatbotToWaiting.ts"
  ];

  it("core não acopla WASocket/Baileys nem ramifica por provider", () => {
    files.forEach(file => {
      const src = fs.readFileSync(path.join(coreDir, file), "utf8");
      expect(src).not.toMatch(/from ["']@whiskeysockets\/baileys["']/);
      expect(src).not.toMatch(/GetTicketWbot/);
      expect(src).not.toMatch(/GetWhatsappWbot/);
      expect(src).not.toMatch(/wrapBaileysSession/);
      expect(src).not.toMatch(/\bgetWbot\s*\(/);
      expect(src).not.toMatch(/\bWASocket\b/);
      expect(src).not.toMatch(/\bproto\./);
      expect(src).not.toMatch(/provider\s*===\s*/);
      expect(src).not.toMatch(/connectionProvider\s*===\s*/);
    });
  });
});
