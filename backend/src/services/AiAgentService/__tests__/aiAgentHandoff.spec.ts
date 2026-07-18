jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

/** Evita carregar database via PgVectorStore nos testes de Handoff. */
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
    .mockResolvedValue({ acquired: true, key: "test-handoff-lock", redisUnavailable: false }),
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

const ticketUpdateMock = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    update: ticketUpdateMock
  }
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

jest.mock("../isTicketIntegrationActive", () => ({
  isTicketIntegrationActive: jest.fn().mockResolvedValue({ active: false })
}));

jest.mock("../isFlowAutomationActive", () => ({
  isFlowAutomationActive: jest.fn().mockReturnValue({ active: false })
}));

jest.mock("../../../helpers/shouldBypassChatbot", () => ({
  shouldBypassChatbot: jest.fn().mockResolvedValue({ bypass: false })
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

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}));

jest.mock("../../../helpers/companyTicketSocket", () => ({
  toCompanyTicketAudience: jest.fn(() => ({ emit: jest.fn() }))
}));

import ShowTicketService from "../../TicketServices/ShowTicketService";
import { buildAiAgentRuntimeContext } from "../buildAiAgentRuntimeContext";

const mockedBuildCtx = buildAiAgentRuntimeContext as jest.Mock;
const mockedShowTicket = ShowTicketService as jest.Mock;

import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import Whatsapp from "../../../models/Whatsapp";
import AiAgent from "../../../models/AiAgent";
import { generateChatCompletionViaAdapter } from "../../AiProviderService/AiProviderAdapterFactory";
import sendAiAgentWhatsappMessage from "../sendAiAgentWhatsappMessage";
import { generateAndSendLiveResponseForLog } from "../AiAgentLiveService";
import AiAgentOrchestrator from "../AiAgentOrchestrator";
import {
  AI_AGENT_LIVE_DELIVERY_STATUSES,
  AI_AGENT_LIVE_STATUSES
} from "../aiAgentLiveErrors";
import { InboundMessageClassification } from "../classifyInboundMessage";
import ResumeTicketAiAgentService from "../../TicketServices/ResumeTicketAiAgentService";

const mockedGenerate = generateChatCompletionViaAdapter as jest.Mock;
const mockedSend = sendAiAgentWhatsappMessage as jest.Mock;

function ticket(partial: Record<string, unknown>) {
  const row = {
    update: ticketUpdateMock,
    ...partial
  };
  return row as unknown as Ticket;
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

describe("AiAgent handoff 1.5", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AiAgentRuntimeLog.count as jest.Mock).mockResolvedValue(0);
    (AiAgentRuntimeLog.findAll as jest.Mock).mockResolvedValue([]);
    (AiAgentRuntimeLog.update as jest.Mock).mockResolvedValue([1]);
    mockedShowTicket.mockResolvedValue(
      ticket({ id: 1, companyId: 1, status: "pending", userId: null })
    );
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: { id: 3, aiAgentMode: "live", aiAgentEnabled: true, aiAgentId: 9 },
      aiAgent: agent({ id: 9, enabled: true }),
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: false,
        aiAgentHandoffRequested: false,
        chatbot: false,
        isGroup: false
      })
    });
  });

  it("remove marcador e aplica handoff após envio", async () => {
    const ticketRow = ticket({
      id: 1,
      companyId: 1,
      contactId: 2,
      status: "pending",
      userId: null,
      aiAgentPaused: false,
      aiAgentHandoffRequested: false,
      chatbot: false,
      isGroup: false,
      contact: contact({ id: 2, name: "João" })
    });

    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({
      id: 80,
      companyId: 1,
      ticketId: 1,
      contactId: 2,
      whatsappId: 3,
      aiAgentId: 9,
      eligible: true,
      mode: "live",
      liveStatus: AI_AGENT_LIVE_STATUSES.QUEUED
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue(ticketRow);
    (Contact.findOne as jest.Mock).mockResolvedValue(contact({ id: 2, name: "João" }));
    (Whatsapp.findOne as jest.Mock).mockResolvedValue({
      id: 3,
      aiAgentMode: "live",
      aiAgentEnabled: true,
      aiAgentId: 9
    });
    (AiAgent.findOne as jest.Mock).mockResolvedValue(
      agent({ id: 9, enabled: true, model: "gpt-4o-mini", maxTokens: 256, temperature: 0.2 })
    );

    mockedGenerate.mockResolvedValue({
      ok: true,
      text: "Vou deixar disponível para um atendente.\n[HANDOFF_HUMAN]",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 100,
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18
    });
    mockedSend.mockResolvedValue({ ok: true, messageId: "OUT-HANDOFF" });

    await generateAndSendLiveResponseForLog(80, 1, "Quero humano", textClassification);

    expect(mockedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Vou deixar disponível para um atendente."
      })
    );
    expect(ticketUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aiAgentHandoffRequested: true,
        aiAgentPaused: true
      })
    );
  });

  it("bloqueia nova resposta quando handoff solicitado", async () => {
    mockedBuildCtx.mockResolvedValue({
      planHasAiAgent: true,
      whatsapp: { id: 3, aiAgentMode: "live", aiAgentEnabled: true, aiAgentId: 9 },
      aiAgent: agent({ id: 9, enabled: true }),
      ticket: ticket({
        id: 1,
        status: "pending",
        userId: null,
        aiAgentPaused: true,
        aiAgentHandoffRequested: true,
        chatbot: false,
        isGroup: false
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
        aiAgentPaused: true,
        aiAgentHandoffRequested: true,
        queueId: null
      }),
      contact: contact({ id: 2 }),
      whatsapp: {
        id: 3,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        aiAgentId: 9
      } as Whatsapp,
      message: {
        id: "MSG-H1",
        fromMe: false,
        body: "Ainda estou aqui",
        classification: textClassification
      }
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ai_agent_handoff_requested");
  });

  it("resume limpa handoff", async () => {
    const ticketRow = ticket({
      id: 1,
      companyId: 1,
      aiAgentPaused: true,
      aiAgentHandoffRequested: true,
      aiAgentHandoffReason: "model_requested_handoff"
    });
    const ShowTicketService = require("../../TicketServices/ShowTicketService")
      .default as jest.Mock;
    ShowTicketService.mockResolvedValue(ticketRow);

    await ResumeTicketAiAgentService({ companyId: 1, ticketId: 1 });

    expect(ticketUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aiAgentPaused: false,
        aiAgentHandoffRequested: false,
        aiAgentHandoffReason: null
      })
    );
  });
});
