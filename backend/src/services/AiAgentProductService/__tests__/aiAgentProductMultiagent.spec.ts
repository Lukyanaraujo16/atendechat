import AppError from "../../../errors/AppError";
import {
  encodeAgentRef,
  parseOptionalAgentRef,
  resolveAiAgentProductAgentForOperation
} from "../aiAgentProductAgentRef";
import ListAiAgentProductAgentsService from "../ListAiAgentProductAgentsService";
import CreateAiAgentProductConfigurationService from "../CreateAiAgentProductConfigurationService";
import ExecuteAiAgentProductCommandService from "../ExecuteAiAgentProductCommandService";
import UpdateAiAgentProductConnectionsService from "../UpdateAiAgentProductConnectionsService";
import GetAiAgentProductConfigurationService from "../GetAiAgentProductConfigurationService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    })
  }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));

jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn(),
  buildAiAgentProductSnapshot: jest.fn()
}));

jest.mock("../../AiAgentService/UpsertAiAgentProfileService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../AiAgentService/parseAiProviderCredentialId", () => ({
  __esModule: true,
  parseAiProviderCredentialId: jest.fn()
}));

import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import AiProviderCredential from "../../../models/AiProviderCredential";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductSummaryService, {
  resolveAiAgentProductAvailability,
  buildAiAgentProductSnapshot
} from "../GetAiAgentProductSummaryService";

const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockAgentCreate = AiAgent.create as jest.Mock;
const mockProfileFindAll = AiAgentProfile.findAll as jest.Mock;
const mockProfileFindOne = AiAgentProfile.findOne as jest.Mock;
const mockCredFindAll = AiProviderCredential.findAll as jest.Mock;
const mockCredFindOne = AiProviderCredential.findOne as jest.Mock;
const mockWaFindAll = Whatsapp.findAll as jest.Mock;
const mockSummary = GetAiAgentProductSummaryService as jest.Mock;
const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockSnapshot = buildAiAgentProductSnapshot as jest.Mock;

function adminReq(companyId = 10) {
  return { user: { id: 1, profile: "admin", companyId } } as any;
}

function makeAgent(partial: Record<string, unknown> = {}) {
  const agent: any = {
    id: 1,
    companyId: 10,
    enabled: false,
    name: "Comercial",
    description: null,
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt: "prompt",
    fallbackMessage: null,
    handoffMessage: null,
    aiProviderCredentialId: 5,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    reload: jest.fn(async function reload(this: any) {
      return this;
    }),
    ...partial
  };
  return agent;
}

function makeWa(partial: Record<string, unknown> = {}) {
  return {
    id: 9,
    companyId: 10,
    name: "WA Comercial",
    status: "CONNECTED",
    aiAgentId: null,
    aiAgentMode: "disabled",
    aiAgentEnabled: false,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    ...partial
  };
}

function summaryPayload() {
  return {
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "setup_incomplete",
    mode: "off",
    agent: { exists: true, id: 1, agentRef: "1", name: "Comercial", enabled: false },
    connection: { linked: false },
    connectionScope: {
      type: "all_linked",
      count: 0,
      connectedCount: 0,
      disconnectedCount: 0,
      names: []
    },
    agentScope: { type: "single", count: 1 },
    readiness: {
      ready: false,
      status: "setup_incomplete",
      mode: "off",
      nextAction: "configure_agent",
      checks: []
    }
  };
}

describe("Fase 2.9A — Product multiagente", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSummary.mockResolvedValue(summaryPayload());
    mockProfileFindAll.mockResolvedValue([]);
    mockProfileFindOne.mockResolvedValue(null);
    mockCredFindAll.mockResolvedValue([
      { id: 5, provider: "openai", enabled: true }
    ]);
    mockCredFindOne.mockResolvedValue({
      id: 5,
      provider: "openai",
      enabled: true,
      name: "Cred",
      apiKeyMasked: "sk-…"
    });
    mockWaFindAll.mockResolvedValue([]);
    mockSnapshot.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true,
      agents: [
        {
          id: 1,
          name: "Comercial",
          enabled: false,
          hasProvider: true,
          hasInstructions: true,
          explicitlyPaused: false
        },
        {
          id: 2,
          name: "Financeiro",
          enabled: false,
          hasProvider: true,
          hasInstructions: true,
          explicitlyPaused: false
        }
      ],
      connections: []
    });
  });

  describe("agentRef helpers", () => {
    it("encodeAgentRef é opaco string do id", () => {
      expect(encodeAgentRef(42)).toBe("42");
    });

    it("parseOptionalAgentRef rejeita formato inválido", () => {
      expect(() => parseOptionalAgentRef("abc")).toThrow(AppError);
    });

    it("0 agentes → not_created", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const r = await resolveAiAgentProductAgentForOperation({ companyId: 10 });
      expect(r.kind).toBe("not_created");
    });

    it("1 agente → resolved sem agentRef", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent()]);
      const r = await resolveAiAgentProductAgentForOperation({ companyId: 10 });
      expect(r.kind).toBe("resolved");
      if (r.kind === "resolved") {
        expect(r.agentRef).toBe("1");
      }
    });

    it("≥2 sem agentRef → AGENT_REF_REQUIRED", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1 }),
        makeAgent({ id: 2, name: "Financeiro" })
      ]);
      await expect(
        resolveAiAgentProductAgentForOperation({ companyId: 10 })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED"
      });
    });

    it("agentRef de outra empresa → NOT_FOUND", async () => {
      mockAgentFindOne.mockResolvedValue(null);
      await expect(
        resolveAiAgentProductAgentForOperation({
          companyId: 10,
          agentRef: "999"
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND",
        statusCode: 404
      });
    });
  });

  describe("listagem", () => {
    it("empresa sem agentes → []", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const out = await ListAiAgentProductAgentsService({
        companyId: 10,
        req: adminReq()
      });
      expect(out.agents).toEqual([]);
    });

    it("empresa com dois agentes → lista ambos (sem ambiguous)", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1, name: "Comercial" }),
        makeAgent({ id: 2, name: "Financeiro" })
      ]);
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 9, aiAgentId: 1, name: "WA Comercial" }),
        makeWa({ id: 10, aiAgentId: 2, name: "WA Financeiro" })
      ]);

      const out = await ListAiAgentProductAgentsService({
        companyId: 10,
        req: adminReq()
      });
      expect(out.agents).toHaveLength(2);
      expect(out.agents.map(a => a.name)).toEqual([
        "Comercial",
        "Financeiro"
      ]);
      expect(out.agents[0].agentRef).toBe("1");
      expect(out.agents[0].connectionCount).toBe(1);
      const json = JSON.stringify(out);
      expect(json).not.toMatch(/apiKey/i);
      expect(json).not.toMatch(/systemPrompt/i);
    });
  });

  describe("criação multiagente", () => {
    it("cria segundo agente e retorna agentRef", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent({ id: 1 })]);
      mockAgentCreate.mockResolvedValue(makeAgent({ id: 2, name: "Financeiro" }));
      mockAgentFindOne.mockResolvedValue(
        makeAgent({ id: 2, name: "Financeiro" })
      );

      const result = await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Financeiro" }
      });
      expect(result.created).toBe(true);
      expect(result.agentRef).toBe("2");
    });

    it("conexão já atribuída → CONNECTION_ALREADY_ASSIGNED", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent({ id: 1 })]);
      mockAgentCreate.mockResolvedValue(makeAgent({ id: 2 }));
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 9, aiAgentId: 1 })
      ]);

      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Financeiro", connectionRefs: ["9"] }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED"
      });
    });
  });

  describe("configuration isolada", () => {
    it("atualizar A não resolve B sem agentRef", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1 }),
        makeAgent({ id: 2, name: "Financeiro" })
      ]);
      await expect(
        GetAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED"
      });
    });

    it("GET com agentRef A carrega A", async () => {
      const agentA = makeAgent({ id: 1, name: "Comercial" });
      mockAgentFindOne.mockResolvedValue(agentA);
      mockWaFindAll.mockResolvedValue([makeWa({ id: 9, aiAgentId: 1 })]);

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        agentRef: "1"
      });
      expect(result.agentRef).toBe("1");
      expect(result.configuration!.identity.name).toBe("Comercial");
    });
  });

  describe("commands isolados", () => {
    it("deactivate A não toca B", async () => {
      const agentA = makeAgent({ id: 1, enabled: true });
      const agentB = makeAgent({ id: 2, name: "Financeiro", enabled: true });
      mockAgentFindOne.mockResolvedValue(agentA);
      const waA = makeWa({
        id: 9,
        aiAgentId: 1,
        aiAgentMode: "live",
        aiAgentEnabled: true
      });
      mockWaFindAll.mockResolvedValue([waA]);

      await ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "deactivate", agentRef: "1" },
        agentRef: "1"
      });

      expect(agentA.update).toHaveBeenCalledWith(
        { enabled: false },
        expect.any(Object)
      );
      expect(agentB.update).not.toHaveBeenCalled();
      // Fase 2.19.1: desativa operação sem apagar aiAgentMode (live|shadow).
      expect(waA.update).toHaveBeenCalledTimes(1);
      const updatePayload = waA.update.mock.calls[0][0];
      expect(updatePayload).toEqual(
        expect.objectContaining({
          aiAgentEnabled: false
        })
      );
      expect(updatePayload).not.toHaveProperty("aiAgentMode");
    });
  });

  describe("connections isoladas", () => {
    it("vincular Comercial não afeta Financeiro", async () => {
      const agentA = makeAgent({ id: 1, enabled: false });
      mockAgentFindOne.mockResolvedValue(agentA);
      // resolve with agentRef uses findOne
      const free = makeWa({ id: 9, aiAgentId: null, name: "WA Comercial" });
      mockWaFindAll
        .mockResolvedValueOnce([free]) // pre desired
        .mockResolvedValueOnce([]) // current linked A
        .mockResolvedValueOnce([free]) // desired in tx
        .mockResolvedValue([makeWa({ id: 9, aiAgentId: 1 })]); // load config

      const result = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        agentRef: "1",
        body: { connectionRefs: ["9"] }
      });
      expect(result.changed).toBe(true);
      expect(free.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiAgentId: 1 }),
        expect.any(Object)
      );
    });

    it("bloqueia conexão já do Financeiro", async () => {
      mockAgentFindOne.mockResolvedValue(makeAgent({ id: 1 }));
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 10, aiAgentId: 2, name: "WA Financeiro" })
      ]);

      await expect(
        UpdateAiAgentProductConnectionsService({
          companyId: 10,
          req: adminReq(),
          agentRef: "1",
          body: { connectionRefs: ["10"] }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED"
      });
    });

    it("transferência manual em duas etapas: desvincular depois vincular", async () => {
      const agentA = makeAgent({ id: 1, name: "Comercial" });
      const agentB = makeAgent({ id: 2, name: "Financeiro" });
      const wa = makeWa({ id: 9, aiAgentId: 1, name: "WA Comercial" });

      // Passo 1: Comercial desvincula (lista vazia — desired não consulta findAll)
      mockAgentFindOne.mockResolvedValueOnce(agentA);
      mockWaFindAll
        .mockResolvedValueOnce([wa]) // current linked A
        .mockResolvedValue([]); // load configuration

      const unlink = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        agentRef: "1",
        body: { connectionRefs: [] }
      });
      expect(unlink.changed).toBe(true);
      expect(wa.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiAgentId: null }),
        expect.any(Object)
      );

      // Passo 2: Financeiro vincula a conexão agora livre
      jest.clearAllMocks();
      mockAvailability.mockResolvedValue({
        enabledByPlan: true,
        accessibleByUser: true
      });
      mockSummary.mockResolvedValue(summaryPayload());
      mockProfileFindAll.mockResolvedValue([]);
      mockProfileFindOne.mockResolvedValue(null);
      mockCredFindAll.mockResolvedValue([
        { id: 5, provider: "openai", enabled: true }
      ]);
      mockCredFindOne.mockResolvedValue({
        id: 5,
        provider: "openai",
        enabled: true
      });

      const free = makeWa({ id: 9, aiAgentId: null, name: "WA Comercial" });
      mockAgentFindOne.mockResolvedValue(agentB);
      mockWaFindAll
        .mockResolvedValueOnce([free]) // pre desired
        .mockResolvedValueOnce([]) // current linked B
        .mockResolvedValueOnce([free]) // desired in tx
        .mockResolvedValue([makeWa({ id: 9, aiAgentId: 2 })]);

      const link = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        agentRef: "2",
        body: { connectionRefs: ["9"] }
      });
      expect(link.changed).toBe(true);
      expect(free.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiAgentId: 2 }),
        expect.any(Object)
      );
    });
  });
});
