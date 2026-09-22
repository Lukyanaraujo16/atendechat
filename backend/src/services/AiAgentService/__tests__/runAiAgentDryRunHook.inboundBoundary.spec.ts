/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../knowledge/integrateKnowledgeIntoRuntime", () => ({
  safeRetrieveKnowledgeForAgent: jest.fn().mockResolvedValue(null),
  applyKnowledgeToSystemPrompt: jest.fn((sys: string) => ({
    systemPrompt: sys,
    knowledgeBlocked: false,
    forceHandoff: false,
    decision: {
      decision: "skip",
      injectKnowledgeContext: false,
      reason: "disabled"
    }
  })),
  buildKnowledgeRuntimeMetadata: jest.fn().mockReturnValue(null),
  resolveKnowledgeRuntimeDecision: jest.fn()
}));

jest.mock("../../KnowledgeBaseService/SearchKnowledgeChunksService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ chunks: [], maxScore: 0 }))
}));

jest.mock("../sendAiAgentWhatsappMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() }
}));

jest.mock("../../../models/AiAgentRuntimeLog", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

const mockedBuildCtx = jest.fn();
jest.mock("../buildAiAgentRuntimeContext", () => ({
  buildAiAgentRuntimeContext: (...a: unknown[]) => mockedBuildCtx(...a)
}));

jest.mock("../../../helpers/shouldBypassChatbot", () => ({
  shouldBypassChatbot: jest.fn().mockResolvedValue({ bypass: false })
}));

jest.mock("../isTicketIntegrationActive", () => ({
  isTicketIntegrationActive: jest.fn().mockResolvedValue({ active: false })
}));

jest.mock("../AiAgentShadowService", () => ({
  scheduleShadowGeneration: jest.fn()
}));

jest.mock("../AiAgentLiveService", () => ({
  scheduleLiveResponse: jest.fn()
}));

jest.mock(
  "../../AutomationOrchestrator/scheduleAutomationObserveFromInbound",
  () => ({
    scheduleAutomationObserveFromInbound: jest.fn().mockResolvedValue(undefined)
  })
);

import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import { runAiAgentDryRunHook } from "../runAiAgentDryRunHook";
import AiAgentOrchestrator from "../AiAgentOrchestrator";
import { scheduleShadowGeneration } from "../AiAgentShadowService";
import { scheduleLiveResponse } from "../AiAgentLiveService";
import { isTicketIntegrationActive } from "../isTicketIntegrationActive";
import { InboundMessageClassification } from "../classifyInboundMessage";

const textClassification: InboundMessageClassification = {
  messageType: "text",
  hasText: true,
  hasMedia: false,
  baileysType: "conversation"
};

function ticket(partial: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 1,
    whatsappId: 10,
    status: "pending",
    userId: null,
    chatbot: false,
    isGroup: false,
    queueId: null,
    flowWebhook: false,
    flowStopped: null,
    lastFlowId: null,
    typebotStatus: false,
    typebotSessionId: null,
    useIntegration: false,
    integrationId: null,
    aiAgentPaused: false,
    aiAgentHandoffRequested: false,
    ...partial
  } as never;
}

function contact() {
  return { id: 5, companyId: 1, name: "Ana" } as never;
}

function whatsapp(partial: Record<string, unknown> = {}) {
  return {
    id: 10,
    companyId: 1,
    aiAgentId: 9,
    aiAgentEnabled: true,
    aiAgentMode: "live",
    ...partial
  } as never;
}

function hookInput(partial: Record<string, unknown> = {}) {
  return {
    companyId: 1,
    ticket: ticket(),
    contact: contact(),
    whatsapp: whatsapp(),
    baileysMessageId: "EVO1",
    persistedMessageId: "EVO1",
    fromMe: false,
    isGroup: false,
    body: "oi",
    classification: textClassification,
    ...partial
  };
}

describe("12.4-B inbound boundary — idempotência e gates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue(null);
    (AiAgentRuntimeLog.create as jest.Mock).mockResolvedValue({ id: 100 });
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp(),
      aiAgent: { id: 9, enabled: true },
      ticket: ticket(),
      contact: contact(),
      companyId: 1,
      channel: "whatsapp",
      message: {
        id: "EVO1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      }
    });
  });

  it("replay do mesmo messageId não avalia nem agenda Shadow/Live de novo", async () => {
    const evaluateSpy = jest.spyOn(
      AiAgentOrchestrator,
      "evaluateInboundMessage"
    );
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({ id: 77 });

    await runAiAgentDryRunHook(hookInput());
    await runAiAgentDryRunHook(hookInput());

    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(scheduleShadowGeneration).not.toHaveBeenCalled();
    expect(scheduleLiveResponse).not.toHaveBeenCalled();
    expect(AiAgentRuntimeLog.create).not.toHaveBeenCalled();
  });

  it("grupo é inelegível (não dispara Live)", async () => {
    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({ isGroup: true }),
      contact: contact(),
      whatsapp: whatsapp(),
      message: {
        id: "GRP1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      },
      persistedMessageId: "GRP1",
      channel: "whatsapp"
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("group_message");
    expect(mockedBuildCtx).not.toHaveBeenCalled();
  });

  it("chatbot ativo bloqueia o Agente", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp(),
      aiAgent: { id: 9, enabled: true },
      ticket: ticket({ chatbot: true }),
      contact: contact(),
      companyId: 1,
      channel: "whatsapp",
      message: {
        id: "BOT1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      }
    });
    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({ chatbot: true }),
      contact: contact(),
      whatsapp: whatsapp(),
      message: {
        id: "BOT1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      },
      persistedMessageId: "BOT1",
      channel: "whatsapp"
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ticket_chatbot_active");
  });

  it("integração/Typebot ativa bloqueia o Agente", async () => {
    (isTicketIntegrationActive as jest.Mock).mockResolvedValue({
      active: true,
      reason: "typebot",
      evidence: { typebotStatus: true }
    });
    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({
        typebotStatus: true,
        typebotSessionId: "sess-1"
      }),
      contact: contact(),
      whatsapp: whatsapp(),
      message: {
        id: "TB1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      },
      persistedMessageId: "TB1",
      channel: "whatsapp"
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ticket_integration_active");
  });

  it("atendimento humano (userId) bloqueia o Agente", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp(),
      aiAgent: { id: 9, enabled: true },
      ticket: ticket({ userId: 7 }),
      contact: contact(),
      companyId: 1,
      channel: "whatsapp",
      message: {
        id: "HUM1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      }
    });
    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({ userId: 7 }),
      contact: contact(),
      whatsapp: whatsapp(),
      message: {
        id: "HUM1",
        fromMe: false,
        body: "oi",
        classification: textClassification
      },
      persistedMessageId: "HUM1",
      channel: "whatsapp"
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ticket_has_human_user");
  });
});
