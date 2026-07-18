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
    decision: { decision: "skip", injectKnowledgeContext: false, reason: "disabled" }
  })),
  buildKnowledgeRuntimeMetadata: jest.fn().mockReturnValue(null),
  resolveKnowledgeRuntimeDecision: jest.fn()
}));

jest.mock("../knowledge/aiAgentGenerationLock", () => ({
  acquireAiAgentGenerationLock: jest
    .fn()
    .mockResolvedValue({ acquired: true, key: "test-live-lock", redisUnavailable: false }),
  releaseAiAgentGenerationLock: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../AiProviderService/AiProviderAdapterFactory", () => ({
  generateChatCompletionViaAdapter: jest.fn()
}));

jest.mock("../sendAiAgentWhatsappMessage", () => ({
  __esModule: true,
  default: jest.fn()
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
import { InboundMessageClassification } from "../classifyInboundMessage";

const mockedGenerate = generateChatCompletionViaAdapter as jest.Mock;
const mockedSend = sendAiAgentWhatsappMessage as jest.Mock;
const mockedBuildCtx = buildAiAgentRuntimeContext as jest.Mock;
const mockedShowTicket = ShowTicketService as jest.Mock;

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
      ticket: ticket({ id: 1, status: "open", userId: 7, chatbot: false, isGroup: false })
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
    jest.spyOn(AiAgentOrchestrator, "evaluateInboundMessage").mockResolvedValue({
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

    expect(mockedGenerate).not.toHaveBeenCalled();
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
    (Contact.findOne as jest.Mock).mockResolvedValue(contact({ id: 2, name: "João" }));
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(
      whatsapp({ id: 3, aiAgentMode: "live", aiAgentEnabled: true, aiAgentId: 9 })
    );
    (AiAgent.findOne as jest.Mock).mockResolvedValue(
      agent({
        id: 9,
        enabled: true,
        model: "gpt-4o-mini",
        maxTokens: 256,
        temperature: 0.2,
        systemPrompt: "Seja educado."
      })
    );
    (AiAgentRuntimeLog.update as jest.Mock).mockResolvedValue([1]);

    mockedGenerate.mockResolvedValue({
      ok: true,
      text: "Olá! Como posso ajudar?",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 120,
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18
    });
    mockedSend.mockResolvedValue({ ok: true, messageId: "OUT1" });

    await generateAndSendLiveResponseForLog(70, 1, "Preciso de ajuda", textClassification);

    expect(mockedGenerate).toHaveBeenCalled();
    expect(mockedSend).toHaveBeenCalled();
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
