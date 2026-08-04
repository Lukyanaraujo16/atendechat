import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import Whatsapp from "../../../models/Whatsapp";
import AiAgent from "../../../models/AiAgent";
import ShowTicketService from "../../TicketServices/ShowTicketService";
import { generateChatCompletionViaAdapter } from "../../AiProviderService/AiProviderAdapterFactory";
import sendAiAgentWhatsappMessage from "../sendAiAgentWhatsappMessage";
import { resolveWhatsappAiAgentRuntimeMode } from "../aiAgentRuntimeMode";
import { runAiAgentDryRunHook } from "../runAiAgentDryRunHook";
import { generateAndSendLiveResponseForLog } from "../AiAgentLiveService";
import AiAgentOrchestrator from "../AiAgentOrchestrator";
import {
  AI_AGENT_LIVE_DELIVERY_STATUSES,
  AI_AGENT_LIVE_STATUSES
} from "../aiAgentLiveErrors";
import { buildAiAgentRuntimeContext } from "../buildAiAgentRuntimeContext";
import PauseTicketAiAgentService from "../../TicketServices/PauseTicketAiAgentService";
import ResumeTicketAiAgentService from "../../TicketServices/ResumeTicketAiAgentService";
import { validateAiAgentLiveResponse } from "../validateAiAgentLiveResponse";
import { generateLiveResponseWithOptionalFc } from "../../AutomationOrchestrator/liveRollout/LiveFunctionCallingService";
import { InboundMessageClassification } from "../classifyInboundMessage";
import { startAiAgentTypingPresence } from "../startAiAgentTypingPresence";
import { applyAiAgentLivePacing } from "../applyAiAgentLivePacing";

jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

/** Evita carregar database via PgVectorStore nos testes de Live. */
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

/** Evita carregar database via PgVectorStore (Live FC → tools → SearchKnowledge). */
jest.mock("../../KnowledgeBaseService/SearchKnowledgeChunksService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ chunks: [], maxScore: 0 }))
}));

jest.mock(
  "../../AutomationOrchestrator/liveRollout/LiveFunctionCallingService",
  () => ({
    generateLiveResponseWithOptionalFc: jest.fn()
  })
);

jest.mock("../knowledge/aiAgentGenerationLock", () => ({
  acquireAiAgentGenerationLock: jest.fn().mockResolvedValue({
    acquired: true,
    key: "test-live-lock",
    redisUnavailable: false
  }),
  releaseAiAgentGenerationLock: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../AiProviderService/AiProviderAdapterFactory", () => ({
  generateChatCompletionViaAdapter: jest.fn()
}));

jest.mock("../sendAiAgentWhatsappMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

/** Fase 2.18 — evita presença real e delays nos testes de Live. */
jest.mock("../startAiAgentTypingPresence", () => ({
  startAiAgentTypingPresence: jest.fn().mockResolvedValue({
    executionId: "test-live-exec",
    started: true,
    stop: jest.fn().mockResolvedValue(undefined)
  }),
  emitAiAgentTypingMetric: jest.fn()
}));

jest.mock("../applyAiAgentLivePacing", () => ({
  applyAiAgentLivePacing: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) }
}));

jest.mock("../../../models/AiAgentRuntimeLog", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
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

jest.mock("../resolveAiAgentBusinessPrompt", () => ({
  ...jest.requireActual("../resolveAiAgentBusinessPrompt"),
  loadAiAgentProfileForRuntime: jest.fn().mockResolvedValue(null)
}));

jest.mock("../../../helpers/shouldBypassChatbot", () => ({
  shouldBypassChatbot: jest.fn().mockResolvedValue({ bypass: false })
}));

jest.mock("../isTicketIntegrationActive", () => ({
  isTicketIntegrationActive: jest.fn().mockResolvedValue({ active: false })
}));

jest.mock("../isFlowAutomationActive", () => ({
  isFlowAutomationActive: jest.fn().mockReturnValue({ active: false })
}));

jest.mock("../resolveAiAgentApiCredential", () => ({
  resolveAiAgentOpenAiApiKeyWithSource: jest.fn().mockResolvedValue({
    apiKey: "sk-test-key",
    provider: "openai",
    source: "agent_credential",
    credentialId: 1
  })
}));

jest.mock("../buildAiAgentRuntimeContext", () => ({
  buildAiAgentRuntimeContext: jest.fn()
}));

jest.mock("../../TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

const mockedLiveGenerate = generateLiveResponseWithOptionalFc as jest.Mock;
const mockedSend = sendAiAgentWhatsappMessage as jest.Mock;
const mockedBuildCtx = buildAiAgentRuntimeContext as jest.Mock;
const mockedShowTicket = ShowTicketService as jest.Mock;
const mockedStartTyping = startAiAgentTypingPresence as jest.Mock;
const mockedApplyPacing = applyAiAgentLivePacing as jest.Mock;

function whatsapp(partial: Record<string, unknown>) {
  return partial as unknown as Whatsapp;
}

function ticket(partial: Record<string, unknown>) {
  return partial as unknown as Ticket;
}

function contact(partial: Record<string, unknown>) {
  return partial as unknown as Contact;
}

function agent(partial: Record<string, unknown>) {
  return partial as unknown as AiAgent;
}

const textClassification: InboundMessageClassification = {
  messageType: "text",
  hasText: true,
  hasMedia: false,
  baileysType: "conversation",
  blockReason: undefined
};

describe("AiAgent live mode 1.4", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      aiAgent: agent({ id: 9, enabled: true }),
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: false,
        chatbot: false,
        isGroup: false,
        queueId: null,
        useIntegration: false
      })
    });
    (AiAgentRuntimeLog.count as jest.Mock).mockResolvedValue(0);
    (AiAgentRuntimeLog.findAll as jest.Mock).mockResolvedValue([]);
  });

  it("aceita modo live sem migrar conexões existentes", () => {
    expect(
      resolveWhatsappAiAgentRuntimeMode(
        whatsapp({ aiAgentMode: "live", aiAgentEnabled: true, aiAgentId: 1 })
      )
    ).toBe("live");
  });

  it("enabled=false + mode live → não elegível (modo preservado)", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: false,
        aiAgentId: 9
      }),
      aiAgent: agent({ id: 9, enabled: false }),
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: false,
        chatbot: false,
        isGroup: false,
        queueId: null
      })
    });

    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        chatbot: false,
        isGroup: false,
        queueId: null
      }),
      contact: contact({ id: 2 }),
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: false,
        aiAgentId: 9
      }),
      message: {
        id: "MSG-OFF",
        fromMe: false,
        body: "Olá",
        classification: textClassification
      }
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ai_agent_disabled");
  });

  it("live não responde se ticket tem userId", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      aiAgent: agent({ id: 9, enabled: true }),
      ticket: ticket({
        id: 1,
        status: "open",
        userId: 7,
        chatbot: false,
        isGroup: false
      })
    });

    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({
        id: 1,
        status: "open",
        userId: 7,
        chatbot: false,
        isGroup: false,
        queueId: null
      }),
      contact: contact({ id: 2 }),
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      message: {
        id: "MSG1",
        fromMe: false,
        body: "Olá",
        classification: textClassification
      }
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ticket_has_human_user");
  });

  it("live não responde se ticket pausado", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      aiAgent: agent({ id: 9, enabled: true }),
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: true,
        chatbot: false,
        isGroup: false,
        queueId: null,
        useIntegration: false
      })
    });

    const result = await AiAgentOrchestrator.evaluateInboundMessage({
      companyId: 1,
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: true,
        chatbot: false,
        isGroup: false,
        queueId: null
      }),
      contact: contact({ id: 2 }),
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      message: {
        id: "MSG2",
        fromMe: false,
        body: "Olá",
        classification: textClassification
      }
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ticket_ai_paused");
  });

  it("dry_run não chama provider nem envia", async () => {
    jest
      .spyOn(AiAgentOrchestrator, "evaluateInboundMessage")
      .mockResolvedValue({
        eligible: true,
        reason: "eligible",
        aiAgentId: 9,
        mode: "dry_run"
      });
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue(null);
    (AiAgentRuntimeLog.create as jest.Mock).mockResolvedValue({ id: 50 });

    await runAiAgentDryRunHook({
      companyId: 1,
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        chatbot: false,
        isGroup: false
      }),
      contact: contact({ id: 2 }),
      whatsapp: whatsapp({
        id: 3,
        aiAgentMode: "dry_run",
        aiAgentEnabled: true,
        aiAgentId: 9
      }),
      baileysMessageId: "MSG3",
      fromMe: false,
      isGroup: false,
      body: "Olá",
      classification: textClassification
    });

    expect(generateChatCompletionViaAdapter).not.toHaveBeenCalled();
    expect(mockedLiveGenerate).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("live gera e envia com sucesso", async () => {
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({
      id: 70,
      companyId: 1,
      ticketId: 1,
      contactId: 2,
      whatsappId: 3,
      aiAgentId: 9,
      eligible: true,
      mode: "live",
      liveStatus: AI_AGENT_LIVE_STATUSES.QUEUED
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue(
      ticket({
        id: 1,
        companyId: 1,
        contactId: 2,
        status: "pending",
        userId: null,
        aiAgentPaused: false,
        chatbot: false,
        isGroup: false,
        contact: contact({ id: 2, name: "João" })
      })
    );
    (Contact.findOne as jest.Mock).mockResolvedValue(
      contact({ id: 2, name: "João" })
    );
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(
      whatsapp({
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      })
    );
    (AiAgent.findOne as jest.Mock).mockResolvedValue(
      agent({
        id: 9,
        name: "Eduardo",
        enabled: true,
        model: "gpt-4o-mini",
        maxTokens: 256,
        temperature: 0.2,
        systemPrompt: "Seja educado."
      })
    );
    (AiAgentRuntimeLog.update as jest.Mock).mockResolvedValue([1]);

    mockedLiveGenerate.mockResolvedValue({
      ok: true,
      text: "Olá! Como posso ajudar?",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 120,
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18,
      forceHandoff: false
    });
    mockedSend.mockResolvedValue({
      ok: true,
      messageId: "OUT1",
      bodySent: "Eduardo:\nOlá! Como posso ajudar?"
    });

    await generateAndSendLiveResponseForLog(
      70,
      1,
      "Preciso de ajuda",
      textClassification
    );

    expect(mockedStartTyping).toHaveBeenCalled();
    expect(mockedLiveGenerate).toHaveBeenCalled();
    expect(mockedApplyPacing).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "normal",
        responseText: "Olá! Como posso ajudar?"
      })
    );
    expect(mockedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Olá! Como posso ajudar?",
        agentName: "Eduardo"
      })
    );
    // typing inicia antes do provider; stop no finally
    const typingCallOrder = mockedStartTyping.mock.invocationCallOrder[0];
    const providerCallOrder = mockedLiveGenerate.mock.invocationCallOrder[0];
    const pacingCallOrder = mockedApplyPacing.mock.invocationCallOrder[0];
    const sendCallOrder = mockedSend.mock.invocationCallOrder[0];
    expect(typingCallOrder).toBeLessThan(providerCallOrder);
    expect(pacingCallOrder).toBeGreaterThan(providerCallOrder);
    expect(pacingCallOrder).toBeLessThan(sendCallOrder);
    const typingHandle = await mockedStartTyping.mock.results[0].value;
    expect(typingHandle.stop).toHaveBeenCalledWith("live_finished");
    expect(AiAgentRuntimeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
        sentMessageId: "OUT1"
      }),
      expect.any(Object)
    );
  });

  it("resposta longa demais não envia", () => {
    const result = validateAiAgentLiveResponse("x".repeat(1300));
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorCode).toBe("live_response_too_long");
    }
  });

  it("pause e resume no ticket", async () => {
    const ticketRow = {
      id: 1,
      companyId: 1,
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockedShowTicket.mockResolvedValue(ticketRow);

    await PauseTicketAiAgentService({ companyId: 1, ticketId: 1, userId: 5 });
    expect(ticketRow.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentPaused: true, aiAgentPausedBy: 5 })
    );

    await ResumeTicketAiAgentService({ companyId: 1, ticketId: 1 });
    expect(ticketRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        aiAgentPaused: false,
        aiAgentPausedAt: null,
        aiAgentPausedBy: null
      })
    );
  });
});
