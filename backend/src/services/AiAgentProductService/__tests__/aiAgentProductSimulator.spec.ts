import AppError from "../../../errors/AppError";
import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import AiProviderCredential from "../../../models/AiProviderCredential";
import AiAgentSimulationMessage from "../../../models/AiAgentSimulationMessage";
import AiAgentSimulationSession from "../../../models/AiAgentSimulationSession";
import GetAiAgentProductSimulatorService from "../GetAiAgentProductSimulatorService";
import CreateAiAgentProductSimulatorSessionService from "../CreateAiAgentProductSimulatorSessionService";
import ListAiAgentProductSimulatorSessionsService from "../ListAiAgentProductSimulatorSessionsService";
import GetAiAgentProductSimulatorSessionService from "../GetAiAgentProductSimulatorSessionService";
import SendAiAgentProductSimulatorMessageService from "../SendAiAgentProductSimulatorMessageService";
import EndAiAgentProductSimulatorSessionService from "../EndAiAgentProductSimulatorSessionService";
import ReviewAiAgentProductSimulatorMessageService from "../ReviewAiAgentProductSimulatorMessageService";
import {
  encodeSimulatorSessionRef,
  encodeSimulatorMessageRef,
  rejectProductSimulatorForbiddenIds,
  resolveProductSimulatorCapability,
  assertProductSimulatorCanMutate
} from "../aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorBootstrap } from "../serializeAiAgentProductSimulator";
import {
  buildAiAgentProductSnapshot,
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";
import { resolveAiAgentProductProviderCompatibility } from "../aiAgentProductProviderCapabilities";

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/AiAgentSimulationMessage", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/AiAgentSimulationSession", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn(),
  buildAiAgentProductSnapshot: jest.fn()
}));

jest.mock("../../AiAgentService/AiAgentSimulationService", () => ({
  __esModule: true,
  createAiAgentSimulationSession: jest.fn(),
  listAiAgentSimulationSessions: jest.fn(),
  showAiAgentSimulationSession: jest.fn(),
  sendAiAgentSimulationMessage: jest.fn(),
  endAiAgentSimulationSession: jest.fn()
}));

jest.mock(
  "../../AiAgentService/UpsertAiAgentSimulationMessageReviewService",
  () => ({
    __esModule: true,
    default: jest.fn()
  })
);

import {
  createAiAgentSimulationSession,
  listAiAgentSimulationSessions,
  showAiAgentSimulationSession,
  sendAiAgentSimulationMessage,
  endAiAgentSimulationSession
} from "../../AiAgentService/AiAgentSimulationService";
import UpsertAiAgentSimulationMessageReviewService from "../../AiAgentService/UpsertAiAgentSimulationMessageReviewService";

const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockSnapshot = buildAiAgentProductSnapshot as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockProfileFindOne = AiAgentProfile.findOne as jest.Mock;
const mockCredFindOne = AiProviderCredential.findOne as jest.Mock;
const mockMsgFindOne = AiAgentSimulationMessage.findOne as jest.Mock;
const mockSessionFindOne = AiAgentSimulationSession.findOne as jest.Mock;
const mockCreate = createAiAgentSimulationSession as jest.Mock;
const mockList = listAiAgentSimulationSessions as jest.Mock;
const mockShow = showAiAgentSimulationSession as jest.Mock;
const mockSend = sendAiAgentSimulationMessage as jest.Mock;
const mockEnd = endAiAgentSimulationSession as jest.Mock;
const mockUpsertReview = UpsertAiAgentSimulationMessageReviewService as jest.Mock;

function adminReq(companyId = 10) {
  return { user: { id: 7, profile: "admin", companyId } } as any;
}

function makeAgent(partial: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 10,
    enabled: true,
    name: "Bot",
    description: "Desc",
    model: "gpt-4o-mini",
    systemPrompt: "Hello",
    aiProviderCredentialId: 5,
    ...partial
  };
}

function agentSnap(partial: Record<string, unknown> = {}) {
  const model = String(partial.model || "gpt-4o-mini");
  const linkedCredential =
    partial.linkedCredential !== undefined
      ? (partial.linkedCredential as { provider: string; enabled: boolean } | null)
      : { provider: "openai", enabled: true };
  const providerCompatibility =
    (partial.providerCompatibility as ReturnType<
      typeof resolveAiAgentProductProviderCompatibility
    >) ||
    resolveAiAgentProductProviderCompatibility({
      model,
      linkedCredential
    });
  const { linkedCredential: _lc, providerCompatibility: _pc, ...rest } =
    partial;
  return {
    id: 1,
    name: "Bot",
    enabled: true,
    hasProvider: providerCompatibility.ready === true,
    hasInstructions: true,
    explicitlyPaused: false,
    providerCompatibility,
    ...rest
  };
}

function snapshotWithAgents(agents: ReturnType<typeof agentSnap>[]) {
  return {
    enabledByPlan: true,
    accessibleByUser: true,
    agents,
    connections: []
  };
}

function stubSingleReady() {
  mockAvailability.mockResolvedValue({
    enabledByPlan: true,
    accessibleByUser: true
  });
  mockSnapshot.mockResolvedValue(snapshotWithAgents([agentSnap()]));
  mockAgentFindOne.mockResolvedValue(makeAgent());
  mockProfileFindOne.mockResolvedValue({ businessSegment: "retail" });
  mockCredFindOne.mockResolvedValue({
    id: 5,
    companyId: 10,
    provider: "openai",
    enabled: true
  });
  mockList.mockResolvedValue({ sessions: [], count: 0, hasMore: false });
}

describe("aiAgentProductSimulator — Fase 2.5", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSingleReady();
  });

  describe("refs e reject", () => {
    it("encode/decode session e message refs", () => {
      expect(encodeSimulatorSessionRef(42)).toBe("sim_s_42");
      expect(encodeSimulatorMessageRef(9)).toBe("sim_m_9");
    });

    it("rejeita agentId no body", () => {
      expect(() =>
        rejectProductSimulatorForbiddenIds({
          body: { agentId: 1 },
          query: {},
          params: {}
        } as any)
      ).toThrow(AppError);
      try {
        rejectProductSimulatorForbiddenIds({
          body: { agentId: 1 },
          query: {},
          params: {}
        } as any);
      } catch (e: any) {
        expect(e.message).toBe("ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID");
      }
    });

    it("rejeita companyId na query", () => {
      expect(() =>
        rejectProductSimulatorForbiddenIds({
          body: {},
          query: { companyId: 99 },
          params: {}
        } as any)
      ).toThrow(/ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID/);
    });
  });

  describe("capability — escopos", () => {
    it("zero agents → not_created", async () => {
      mockSnapshot.mockResolvedValue(snapshotWithAgents([]));
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.available).toBe(false);
      expect(cap.reason).toBe("not_created");
      expect(cap.canSimulate).toBe(false);
    });

    it("ambiguous → ambiguous", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([
          agentSnap({ id: 1 }),
          agentSnap({ id: 2, name: "B" })
        ])
      );
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.available).toBe(false);
      expect(cap.reason).toBe("ambiguous");
    });

    it("OpenAI linked ready → canSimulate", async () => {
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.canSimulate).toBe(true);
      expect(cap.available).toBe(true);
      expect(cap.reason).toBeNull();
      expect(cap.providerLabel).toBe("OpenAI");
    });

    it("Gemini linked ready → canSimulate", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([
          agentSnap({
            model: "gemini-2.0-flash",
            linkedCredential: { provider: "gemini", enabled: true }
          })
        ])
      );
      mockAgentFindOne.mockResolvedValue(
        makeAgent({ model: "gemini-2.0-flash", aiProviderCredentialId: 8 })
      );
      mockCredFindOne.mockResolvedValue({
        id: 8,
        provider: "gemini",
        enabled: true
      });
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.canSimulate).toBe(true);
      expect(cap.providerLabel).toBe("Google Gemini");
    });

    it("company_default NÃO habilita sem aiProviderCredentialId", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([
          agentSnap({
            linkedCredential: null,
            hasProvider: false
          })
        ])
      );
      mockAgentFindOne.mockResolvedValue(
        makeAgent({ aiProviderCredentialId: null })
      );
      mockCredFindOne.mockResolvedValue(null);
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.canSimulate).toBe(false);
      expect(cap.reason).toBe("credential_not_selected");
    });

    it("credential disabled → credential_disabled", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([
          agentSnap({
            linkedCredential: { provider: "openai", enabled: false }
          })
        ])
      );
      mockCredFindOne.mockResolvedValue({
        id: 5,
        provider: "openai",
        enabled: false
      });
      const cap = await resolveProductSimulatorCapability(10, adminReq());
      expect(cap.canSimulate).toBe(false);
      expect(cap.reason).toBe("credential_disabled");
    });
  });

  describe("bootstrap", () => {
    it("retorna bootstrap comercial sem ids técnicos", async () => {
      const data = await GetAiAgentProductSimulatorService({
        companyId: 10,
        req: adminReq()
      });
      expect(data.available).toBe(true);
      expect(data.capabilities.canSimulate).toBe(true);
      expect(data.scenarioSegment).toBe("retail");
      expect(data.agent.name).toBe("Bot");
      expect(JSON.stringify(data)).not.toMatch(/companyId|aiAgentId|apiKey/);
      const again = serializeAiAgentProductSimulatorBootstrap(data);
      expect(again.sessions).toEqual([]);
    });

    it("not_created bootstrap", async () => {
      mockSnapshot.mockResolvedValue(snapshotWithAgents([]));
      mockAgentFindOne.mockResolvedValue(null);
      const data = await GetAiAgentProductSimulatorService({
        companyId: 10,
        req: adminReq()
      });
      expect(data.available).toBe(false);
      expect(data.reason).toBe("not_created");
      expect(data.sessions).toEqual([]);
    });
  });

  describe("happy path create/list/get/send/end/review", () => {
    it("create session", async () => {
      mockCreate.mockResolvedValue({
        id: 11,
        status: "active",
        provider: "openai",
        model: "gpt-4o-mini",
        messageCount: 0,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        messages: []
      });
      const session = await CreateAiAgentProductSimulatorSessionService({
        companyId: 10,
        userId: 7,
        req: adminReq()
      });
      expect(session.ref).toBe("sim_s_11");
      expect(session.status).toBe("active");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ aiAgentId: 1, createdBy: 7 })
      );
      expect(session).not.toHaveProperty("id");
      expect(session).not.toHaveProperty("totalTokens");
    });

    it("list sessions", async () => {
      mockList.mockResolvedValue({
        sessions: [
          {
            id: 11,
            status: "active",
            provider: "openai",
            model: "gpt-4o-mini",
            messageCount: 2,
            startedAt: new Date(),
            endedAt: null
          }
        ],
        count: 1,
        hasMore: false
      });
      const listed = await ListAiAgentProductSimulatorSessionsService({
        companyId: 10,
        req: adminReq()
      });
      expect(listed.sessions[0].ref).toBe("sim_s_11");
      expect(listed.count).toBe(1);
    });

    it("get session with messages", async () => {
      mockShow.mockResolvedValue({
        id: 11,
        status: "active",
        provider: "openai",
        model: "gpt-4o-mini",
        messageCount: 2,
        startedAt: new Date(),
        endedAt: null,
        averageLatencyMs: 120,
        messages: [
          {
            id: 100,
            role: "user",
            content: "Oi",
            createdAt: new Date(),
            latencyMs: null,
            handoffSuggested: false,
            review: null
          },
          {
            id: 101,
            role: "assistant",
            content: "Olá",
            createdAt: new Date(),
            latencyMs: 120,
            handoffSuggested: false,
            review: null
          }
        ]
      });
      const session = await GetAiAgentProductSimulatorSessionService({
        companyId: 10,
        sessionRef: "sim_s_11",
        req: adminReq()
      });
      expect(session.messages).toHaveLength(2);
      expect(session.messages![1].ref).toBe("sim_m_101");
      expect(session.messages![1].responseTimeMs).toBe(120);
      expect(JSON.stringify(session)).not.toMatch(/promptTokens|functionCalling/);
    });

    it("send message sem functionCalling", async () => {
      mockSend.mockResolvedValue({
        userMessage: {
          id: 100,
          role: "user",
          content: "Oi",
          createdAt: new Date()
        },
        assistantMessage: {
          id: 101,
          role: "assistant",
          content: "Olá",
          createdAt: new Date(),
          latencyMs: 50,
          handoffSuggested: false
        },
        session: { id: 11, messageCount: 2, totalTokens: 99, totalLatencyMs: 50 }
      });
      const result = await SendAiAgentProductSimulatorMessageService({
        companyId: 10,
        sessionRef: "sim_s_11",
        content: "Oi",
        userId: 7,
        req: adminReq()
      });
      expect(mockSend.mock.calls[0][0].functionCalling).toBeUndefined();
      expect(result.userMessage.ref).toBe("sim_m_100");
      expect(result.assistantMessage.ref).toBe("sim_m_101");
      expect(result).not.toHaveProperty("functionCalling");
      expect(result).not.toHaveProperty("knowledge");
    });

    it("end session", async () => {
      mockEnd.mockResolvedValue({
        id: 11,
        status: "ended",
        endedAt: new Date("2026-01-01T01:00:00Z")
      });
      const result = await EndAiAgentProductSimulatorSessionService({
        companyId: 10,
        sessionRef: "sim_s_11",
        req: adminReq()
      });
      expect(result.ref).toBe("sim_s_11");
      expect(result.status).toBe("ended");
    });

    it("review assistant message", async () => {
      mockMsgFindOne.mockResolvedValue({
        id: 101,
        companyId: 10,
        sessionId: 11,
        role: "assistant",
        content: "Olá"
      });
      mockSessionFindOne.mockResolvedValue({
        id: 11,
        companyId: 10,
        aiAgentId: 1
      });
      mockUpsertReview.mockResolvedValue({
        id: 1,
        rating: "good",
        tags: ["clear"],
        note: null,
        reviewedBy: 7,
        reviewedAt: new Date()
      });
      const review = await ReviewAiAgentProductSimulatorMessageService({
        companyId: 10,
        messageRef: "sim_m_101",
        userId: 7,
        body: { rating: "good", tags: ["clear"] },
        req: adminReq()
      });
      expect(review.rating).toBe("good");
      expect(review).not.toHaveProperty("reviewedBy");
      expect(review).not.toHaveProperty("id");
    });
  });

  describe("guards", () => {
    it("assert mutate bloqueia sem credencial", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([agentSnap({ linkedCredential: null })])
      );
      mockAgentFindOne.mockResolvedValue(
        makeAgent({ aiProviderCredentialId: null })
      );
      mockCredFindOne.mockResolvedValue(null);
      await expect(
        assertProductSimulatorCanMutate(10, adminReq())
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE"
      });
    });

    it("session de outro agente → not found", async () => {
      mockShow.mockRejectedValue(
        new AppError(
          "ERR_AI_AGENT_SIMULATION_SESSION_NOT_FOUND",
          404,
          "Sessão de simulação não encontrada."
        )
      );
      await expect(
        GetAiAgentProductSimulatorSessionService({
          companyId: 10,
          sessionRef: "sim_s_999",
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND"
      });
    });

    it("sessão encerrada no send", async () => {
      mockSend.mockRejectedValue(
        new AppError(
          "ERR_AI_AGENT_SIMULATOR_SESSION_ENDED",
          400,
          "Esta sessão de simulação já foi encerrada."
        )
      );
      await expect(
        SendAiAgentProductSimulatorMessageService({
          companyId: 10,
          sessionRef: "sim_s_11",
          content: "Oi",
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_ENDED"
      });
    });

    it("review mensagem não assistant", async () => {
      mockMsgFindOne.mockResolvedValue({
        id: 100,
        companyId: 10,
        sessionId: 11,
        role: "user",
        content: "Oi"
      });
      mockSessionFindOne.mockResolvedValue({
        id: 11,
        companyId: 10,
        aiAgentId: 1
      });
      await expect(
        ReviewAiAgentProductSimulatorMessageService({
          companyId: 10,
          messageRef: "sim_m_100",
          userId: 7,
          body: { rating: "good" },
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID"
      });
    });

    it("review mensagem de outro agente", async () => {
      mockMsgFindOne.mockResolvedValue({
        id: 101,
        companyId: 10,
        sessionId: 11,
        role: "assistant"
      });
      mockSessionFindOne.mockResolvedValue({
        id: 11,
        companyId: 10,
        aiAgentId: 999
      });
      await expect(
        ReviewAiAgentProductSimulatorMessageService({
          companyId: 10,
          messageRef: "sim_m_101",
          userId: 7,
          body: { rating: "good" },
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND"
      });
    });

    it("create rejeita quando ambiguous", async () => {
      mockSnapshot.mockResolvedValue(
        snapshotWithAgents([
          agentSnap({ id: 1 }),
          agentSnap({ id: 2 })
        ])
      );
      await expect(
        CreateAiAgentProductSimulatorSessionService({
          companyId: 10,
          userId: 7,
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS"
      });
    });
  });
});
