/* eslint-disable import/first */
import fs from "fs";
import path from "path";

const getWbot = jest.fn();
const sendWhatsAppMessage = jest.fn().mockResolvedValue({ key: { id: "S1" } });
const typebotListener = jest.fn().mockResolvedValue(undefined);
const evaluateFlowCondition = jest.fn().mockResolvedValue({ passed: true });
const pickConditionEdgeTarget = jest.fn().mockReturnValue("trueNode");
const executeHttp = jest.fn().mockResolvedValue({
  outcome: "success",
  method: "GET",
  urlForLog: "https://example.test",
  httpStatus: 200,
  extractedKeys: [],
  nextHandle: "success"
});
const pickHttp = jest.fn().mockReturnValue("okNode");
const randomizarCaminho = jest.fn().mockReturnValue("A");
const showQueue = jest.fn().mockResolvedValue({ id: 4, name: "Suporte" });
const updateTicket = jest.fn().mockResolvedValue({ ticket: {} });
const showTicket = jest.fn();
const userFindOne = jest.fn();
const ticketTagFindOne = jest.fn().mockResolvedValue(null);
const ticketTagCreate = jest.fn().mockResolvedValue({});
const setDisableBot = jest.fn().mockResolvedValue({});
const sendMessage = jest.fn().mockResolvedValue(undefined);
const addContactList = jest.fn().mockResolvedValue(undefined);
const getOutbound = jest.fn().mockResolvedValue({ provider: "evolution" });
const getIO = jest.fn().mockReturnValue({
  to: () => ({ emit: jest.fn() })
});

jest.mock("../../../libs/socket", () => ({
  getIO: () => getIO()
}));

jest.mock("../../../libs/wbot", () => ({
  getWbot: (...a: unknown[]) => getWbot(...a)
}));

jest.mock("../../WbotServices/SendWhatsAppMessage", () => ({
  __esModule: true,
  default: (...a: unknown[]) => sendWhatsAppMessage(...a)
}));

jest.mock("../../TypebotServices/typebotListener", () => ({
  __esModule: true,
  default: (...a: unknown[]) => typebotListener(...a)
}));

jest.mock("../../TypebotServices/typebotLegacyMedia", () => ({
  createTypebotLegacyUrlMediaSender: jest.fn()
}));

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../FlowBuilderService/EvaluateFlowConditionService", () => ({
  evaluateFlowCondition: (...a: unknown[]) => evaluateFlowCondition(...a),
  pickConditionEdgeTarget: (...a: unknown[]) => pickConditionEdgeTarget(...a)
}));

jest.mock("../../FlowBuilderService/ExecuteFlowHttpRequestService", () => ({
  executeFlowHttpRequestAndPersist: (...a: unknown[]) => executeHttp(...a),
  pickHttpRequestEdgeTarget: (...a: unknown[]) => pickHttp(...a)
}));

jest.mock("../../../utils/randomizador", () => ({
  randomizarCaminho: (...a: unknown[]) => randomizarCaminho(...a)
}));

jest.mock("../../QueueService/ShowQueueService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showQueue(...a)
}));

jest.mock("../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => updateTicket(...a)
}));

jest.mock("../../TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showTicket(...a)
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findOne: (...a: unknown[]) => userFindOne(...a) }
}));

jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => ticketTagFindOne(...a),
    create: (...a: unknown[]) => ticketTagCreate(...a)
  }
}));

jest.mock("../../ContactServices/SetContactDisableBotService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => setDisableBot(...a)
}));

jest.mock("../../../helpers/SendMessage", () => ({
  SendMessage: (...a: unknown[]) => sendMessage(...a)
}));

jest.mock(
  "../../FlowBuilderService/AddContactToContactListFromTicketService",
  () => ({
    __esModule: true,
    default: (...a: unknown[]) => addContactList(...a)
  })
);

jest.mock("../../WhatsappService/ShowWhatsAppService", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    id: 10,
    status: "CONNECTED",
    companyId: 1
  })
}));

const ticketUpdate = jest.fn(async function update(
  this: Record<string, unknown>,
  data: Record<string, unknown>
) {
  Object.assign(this, data);
});

const ticketRow = {
  id: 77,
  companyId: 1,
  whatsappId: 10,
  contactId: 5,
  queueId: 4,
  userId: null,
  status: "pending",
  contact: { id: 5, name: "Ana", number: "5511999998888", email: "a@b.c" },
  update: ticketUpdate,
  dataWebhook: { variables: {} }
};

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => ticketRow)
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => ticketRow.contact) }
}));

jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/SetTicketMessagesAsRead", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../WbotServices/SendWhatsAppMediaFlow", () => ({
  __esModule: true,
  default: jest.fn(),
  typeSimulation: jest.fn()
}));

jest.mock("../../FlowBuilderService/FlowExecutionLogService", () => ({
  createFlowExecutionLogIfTicket: jest.fn()
}));

jest.mock("../../FlowBuilderService/flowMenuTimeoutScheduler", () => ({
  cancelFlowMenuTimeout: jest.fn().mockResolvedValue(undefined),
  scheduleFlowMenuTimeout: jest.fn()
}));

jest.mock("../../TicketServices/FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../IntegrationsServices/OpenAiService", () => ({
  handleOpenAi: jest.fn()
}));

jest.mock("../../../controllers/MessageController", () => ({
  sendMessageFlow: jest.fn()
}));

jest.mock("../../ContactServices/CreateContactService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/GetDefaultWhatsApp", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/SendMessageFlow", () => ({
  SendMessageFlow: jest.fn()
}));

jest.mock("../../WbotServices/SendWhatsAppMedia", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../TicketServices/ShowTicketFromUUIDService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/Webhook", () => ({
  WebhookModel: { findOne: jest.fn() }
}));

jest.mock("uuid", () => ({
  v4: () => "uuid-1"
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest
    .fn()
    .mockResolvedValue("5511999998888@s.whatsapp.net"),
  parseTicketDataWebhook: (dw: unknown) =>
    dw && typeof dw === "object" ? dw : {}
}));

jest.mock("bluebird", () => ({
  delay: jest.fn().mockResolvedValue(undefined)
}));

import { ActionsWebhookService } from "../ActionsWebhookService";

async function runNode(
  node: { id: string; type: string; data?: unknown },
  extra?: {
    pressKey?: string | null;
    msg?: unknown;
    inboundHint?: { remoteJid?: string; body?: string };
    connections?: Array<{
      source: string;
      target: string;
      sourceHandle?: string;
    }>;
  }
) {
  showTicket.mockResolvedValue({
    ...ticketRow,
    contact: ticketRow.contact,
    update: ticketUpdate,
    companyId: 1
  });
  return ActionsWebhookService(
    10,
    9,
    1,
    [node] as never,
    (extra?.connections || []) as never,
    node.id,
    { variables: {} },
    "",
    "hash",
    extra?.pressKey ?? null,
    77,
    { number: "5511999998888", name: "Ana", email: "a@b.c" },
    extra?.msg as never,
    extra?.inboundHint
  );
}

describe("ActionsWebhookService provider-neutral 12.3-E", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn();
      return 0 as unknown as NodeJS.Timeout;
    });
    ticketUpdate.mockClear();
    updateTicket.mockResolvedValue({ ticket: ticketRow });
    Object.assign(ticketRow, {
      id: 77,
      companyId: 1,
      whatsappId: 10,
      contactId: 5,
      queueId: 4,
      userId: null,
      status: "pending",
      flowWebhook: false,
      lastFlowId: null,
      dataWebhook: { variables: {} }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("message textual usa SendWhatsAppMessage e não getWbot", async () => {
    await runNode({
      id: "msg1",
      type: "message",
      data: { label: "Olá" }
    });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(String) })
    );
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("question textual envia via SendWhatsAppMessage e persiste lastFlowId", async () => {
    await runNode({
      id: "q1",
      type: "question",
      data: {
        typebotIntegration: { message: "Qual cidade?", answerKey: "cidade" }
      }
    });
    expect(sendWhatsAppMessage).toHaveBeenCalled();
    expect(ticketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastFlowId: "q1",
        flowStopped: "9"
      })
    );
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("waitForInteraction persiste estado e para", async () => {
    await runNode({ id: "w1", type: "waitForInteraction", data: {} });
    expect(ticketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastFlowId: "w1",
        flowStopped: "9"
      })
    );
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("menu textual envia opções numeradas", async () => {
    await runNode({
      id: "menu1",
      type: "menu",
      data: {
        message: "Escolha",
        arrayOption: [
          { number: 1, value: "Comercial" },
          { number: 2, value: "Suporte" }
        ]
      }
    });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/1 - Comercial[\s\S]*2 - Suporte/)
      })
    );
  });

  it("condition usa pressKey/inboundHint e segue o ramo correto", async () => {
    await runNode(
      { id: "c1", type: "condition", data: { key: "cidade" } },
      {
        pressKey: "Recife",
        inboundHint: { body: "Recife" },
        connections: [
          { source: "c1", target: "trueNode", sourceHandle: "true" },
          { source: "c1", target: "falseNode", sourceHandle: "false" }
        ]
      }
    );
    expect(evaluateFlowCondition).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "Recife",
      1
    );
    expect(pickConditionEdgeTarget).toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("randomizer executa sem dependência de provider", async () => {
    await runNode(
      { id: "r1", type: "randomizer", data: { percent: 50 } },
      {
        connections: [
          { source: "r1", target: "aNode", sourceHandle: "a" },
          { source: "r1", target: "bNode", sourceHandle: "b" }
        ]
      }
    );
    expect(randomizarCaminho).toHaveBeenCalledWith(0.5);
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("HTTP Request avança o grafo no core", async () => {
    await runNode(
      { id: "h1", type: "httpRequest", data: { url: "https://example.test" } },
      {
        connections: [
          { source: "h1", target: "okNode", sourceHandle: "success" }
        ]
      }
    );
    expect(executeHttp).toHaveBeenCalled();
    expect(pickHttp).toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("sector usa ShowQueueService com companyId", async () => {
    await runNode({
      id: "s1",
      type: "sector",
      data: { queue: { id: 4 } }
    });
    expect(showQueue).toHaveBeenCalledWith(4, 1);
    expect(updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: expect.objectContaining({ queueId: 4 }),
        companyId: 1
      })
    );
  });

  it("attendant valida User no companyId", async () => {
    userFindOne.mockResolvedValue({ id: 12, companyId: 1 });
    await runNode({
      id: "a1",
      type: "attendant",
      data: { user: { id: 12 } }
    });
    expect(userFindOne).toHaveBeenCalledWith({
      where: { id: 12, companyId: 1 }
    });
  });

  it("attendant de outro tenant é ignorado", async () => {
    userFindOne.mockResolvedValue(null);
    await runNode({
      id: "a1",
      type: "attendant",
      data: { user: { id: 99 } }
    });
    expect(userFindOne).toHaveBeenCalledWith({
      where: { id: 99, companyId: 1 }
    });
    expect(updateTicket).not.toHaveBeenCalled();
  });

  it("tag cria TicketTag", async () => {
    await runNode({
      id: "t1",
      type: "tag",
      data: { tag: { id: 7 } }
    });
    expect(ticketTagCreate).toHaveBeenCalledWith({ ticketId: 77, tagId: 7 });
  });

  it("closeTicket chama UpdateTicketService closed", async () => {
    await runNode({ id: "x1", type: "closeTicket", data: {} });
    expect(updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: { status: "closed" },
        companyId: 1
      })
    );
  });

  it("blacklist usa SetContactDisableBotService com companyId", async () => {
    await runNode({ id: "b1", type: "blacklist", data: { action: "add" } });
    expect(setDisableBot).toHaveBeenCalledWith({
      contactId: 5,
      companyId: 1,
      disableBot: true
    });
  });

  it("notification usa SendMessage interpolado, não WASocket", async () => {
    await runNode({
      id: "n1",
      type: "notification",
      data: { phone: "5511988887777", message: "aviso" }
    });
    expect(sendMessage).toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("Typebot node usa outbound e não chama getWbot", async () => {
    await runNode({
      id: "tb1",
      type: "typebot",
      data: { typebotIntegration: { url: "https://typebot.example" } }
    });
    expect(getOutbound).toHaveBeenCalled();
    expect(typebotListener).toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("OpenAI sem msg Baileys não chama getWbot", async () => {
    await runNode({
      id: "ai1",
      type: "openai",
      data: { typebotIntegration: { apiKey: "k", prompt: "p" } }
    });
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("ticket node permanece no-op (código comentado)", async () => {
    await runNode({ id: "tk1", type: "ticket", data: {} });
    expect(updateTicket).not.toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("core textual não importa GetTicketWbot/GetWhatsappWbot no dispatch", () => {
    const dispatchSrc = fs.readFileSync(
      path.join(__dirname, "../../FlowBuilderService/dispatchInboundFlow.ts"),
      "utf8"
    );
    expect(dispatchSrc).not.toMatch(
      /WASocket|getWbot|GetTicketWbot|GetWhatsappWbot|wrapBaileysSession|@whiskeysockets\/baileys|@c\.us/
    );
    expect(dispatchSrc).not.toMatch(/provider ===/);
    expect(dispatchSrc).not.toMatch(/connectionProvider ===/);
  });

  it("Baileys OpenAI legado permanece atrás de msg", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../ActionsWebhookService.ts"),
      "utf8"
    );
    expect(src).toContain("OpenAI node deferred (12.3-E)");
    expect(src).toContain("const wbot = getWbot(whatsapp.id)");
    expect(src).toContain("await handleOpenAi(");
  });

  it("intervalWhats usa setTimeout, não delay do Baileys", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../ActionsWebhookService.ts"),
      "utf8"
    );
    expect(src).toMatch(/setTimeout/);
    expect(src).not.toMatch(/from ["']@whiskeysockets\/baileys["'].*delay/);
    expect(src).not.toContain('delay } from "@whiskeysockets/baileys"');
  });
});
