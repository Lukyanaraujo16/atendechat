import AppError from "../../../errors/AppError";
import requireAiAgentProductView from "../../../middleware/requireAiAgentProductView";
import GetAiAgentProductConfigurationService from "../GetAiAgentProductConfigurationService";
import GetAiAgentProductConfigurationOptionsService from "../GetAiAgentProductConfigurationOptionsService";
import CreateAiAgentProductConfigurationService from "../CreateAiAgentProductConfigurationService";
import UpdateAiAgentProductConfigurationService from "../UpdateAiAgentProductConfigurationService";
import UpdateAiAgentProductConnectionsService from "../UpdateAiAgentProductConnectionsService";
import {
  serializeAiAgentProductConfiguration,
  serializeAiAgentProductConfigurationResult
} from "../serializeAiAgentProduct";

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
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn()
}));

jest.mock("../../AiAgentService/UpsertAiAgentProfileService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../AiAgentService/parseAiProviderCredentialId", () => ({
  __esModule: true,
  parseAiProviderCredentialId: jest.fn()
}));

import sequelize from "../../../database";
import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import AiProviderCredential from "../../../models/AiProviderCredential";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductSummaryService, {
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";
import UpsertAiAgentProfileService from "../../AiAgentService/UpsertAiAgentProfileService";
import { parseAiProviderCredentialId } from "../../AiAgentService/parseAiProviderCredentialId";

const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockSummary = GetAiAgentProductSummaryService as jest.Mock;
const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockAgentCreate = AiAgent.create as jest.Mock;
const mockProfileFindOne = AiAgentProfile.findOne as jest.Mock;
const mockCredFindAll = AiProviderCredential.findAll as jest.Mock;
const mockCredFindOne = AiProviderCredential.findOne as jest.Mock;
const mockWaFindAll = Whatsapp.findAll as jest.Mock;
const mockTx = sequelize.transaction as jest.Mock;
const mockUpsertProfile = UpsertAiAgentProfileService as jest.Mock;
const mockParseCred = parseAiProviderCredentialId as jest.Mock;

function summaryPayload(partial: Record<string, unknown> = {}) {
  return {
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "setup_incomplete",
    mode: "off",
    agent: { exists: true, id: 1, name: "Bot", enabled: false },
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
    },
    ...partial
  };
}

function makeAgent(partial: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 10,
    enabled: false,
    name: "Bot",
    description: "Desc",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt: null,
    fallbackMessage: "Fallback",
    handoffMessage: "Handoff",
    aiProviderCredentialId: null,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    ...partial
  };
}

function makeWa(partial: Record<string, unknown> = {}) {
  return {
    id: 9,
    companyId: 10,
    name: "WA",
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

function makeCred(partial: Record<string, unknown> = {}) {
  return {
    id: 5,
    companyId: 10,
    name: "OpenAI Prod",
    provider: "openai",
    apiKeyMasked: "sk-...XXX",
    apiKeyEncrypted: "ENCRYPTED_SECRET",
    enabled: true,
    isDefault: true,
    ...partial
  };
}

function adminReq(companyId = 10) {
  return {
    user: { id: 1, profile: "admin", companyId }
  } as any;
}

function runMiddleware(user: Record<string, unknown> | undefined) {
  return new Promise<{ err?: any }>(resolve => {
    requireAiAgentProductView({ user } as any, {} as any, (err?: any) =>
      resolve({ err })
    );
  });
}

const baseProfileBody = {
  companyName: "Acme",
  businessSegment: "retail",
  departments: ["sales"],
  attendantName: "Ana",
  tone: "friendly",
  emojiLevel: "low",
  responseLength: "medium",
  allowedActions: [],
  forbiddenActions: [],
  handoffRules: []
};

describe("AiAgent Product Configuration (Fase 2.3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSummary.mockResolvedValue(summaryPayload());
    mockTx.mockImplementation(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    });
    mockUpsertProfile.mockResolvedValue({ id: 1 });
    mockParseCred.mockResolvedValue(5);
    mockProfileFindOne.mockResolvedValue(null);
    mockCredFindOne.mockResolvedValue(null);
    mockCredFindAll.mockResolvedValue([]);
    mockWaFindAll.mockResolvedValue([]);
  });

  describe("autorização", () => {
    it("1. non-admin → 403", async () => {
      const { err } = await runMiddleware({
        id: 2,
        profile: "user",
        companyId: 10
      });
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
      expect(err.statusCode).toBe(403);
    });

    it("2. feature off → NOT_AVAILABLE", async () => {
      mockAvailability.mockResolvedValue({
        enabledByPlan: false,
        accessibleByUser: false
      });
      await expect(
        GetAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
        statusCode: 403
      });
    });

    it("2b. user feature off → ACCESS_DENIED", async () => {
      mockAvailability.mockResolvedValue({
        enabledByPlan: true,
        accessibleByUser: false
      });
      await expect(
        GetAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
        statusCode: 403
      });
    });
  });

  describe("GET configuration", () => {
    it("3. zero agents → null configuration", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockSummary.mockResolvedValue(
        summaryPayload({
          agent: { exists: false },
          agentScope: { type: "none", count: 0 },
          status: "not_created"
        })
      );
      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });
      expect(result.agentScope).toEqual({ type: "none", count: 0 });
      expect(result.configuration).toBeNull();
      expect(result.summary).toBeDefined();
    });

    it("4. single → full config returned", async () => {
      const agent = makeAgent({ aiProviderCredentialId: 5 });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockCredFindOne.mockResolvedValue(makeCred());
      mockProfileFindOne.mockResolvedValue({
        generatedPrompt: "Você é Ana, atendente da Acme. Instruções longas aqui.",
        setupMode: "guided"
      });
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 9, aiAgentId: 1, name: "WA Principal" })
      ]);

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });

      expect(result.agentScope.type).toBe("single");
      expect(result.configuration).not.toBeNull();
      expect(result.configuration!.identity.name).toBe("Bot");
      expect(result.configuration!.model.name).toBe("gpt-4o-mini");
      expect(result.configuration!.instructions.configured).toBe(true);
      expect(result.configuration!.instructions.preview!.length).toBeLessThanOrEqual(
        200
      );
      expect(result.configuration!.provider.configured).toBe(true);
      expect(result.configuration!.credential.maskedKey).toBe("sk-...XXX");
      expect(result.configuration!.connections).toHaveLength(1);
      expect(result.configuration!.connections[0].ref).toBe("9");
      expect(result.editableWhileActive).toBe(true);
    });

    it("5. ambiguous → 409", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1 }),
        makeAgent({ id: 2, name: "Bot2" })
      ]);
      await expect(
        GetAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq()
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        statusCode: 409
      });
    });

    it("6. no secret leaked", async () => {
      const agent = makeAgent({
        systemPrompt: "SECRET_SYSTEM_PROMPT_FULL",
        aiProviderCredentialId: 5
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockCredFindOne.mockResolvedValue(makeCred());
      mockProfileFindOne.mockResolvedValue({
        generatedPrompt: "A".repeat(500),
        setupMode: "guided"
      });

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });
      const json = JSON.stringify(result);
      expect(json).not.toContain("ENCRYPTED_SECRET");
      expect(json).not.toContain("SECRET_SYSTEM_PROMPT_FULL");
      expect(json).not.toContain("apiKeyEncrypted");
      expect(json).not.toContain("systemPrompt");
      expect(json).not.toContain("generatedPrompt");
      expect(json).not.toContain("companyId");
      expect(result.configuration!.instructions.preview!.length).toBe(200);
    });
  });

  describe("GET options", () => {
    it("7. lists providers, credentials (masked), connections", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent()]);
      mockCredFindAll.mockResolvedValue([makeCred()]);
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 9, aiAgentId: 1 }),
        makeWa({ id: 10, aiAgentId: null, name: "Livre" })
      ]);

      const options = await GetAiAgentProductConfigurationOptionsService({
        companyId: 10,
        req: adminReq()
      });

      expect(options.providers).toEqual([
        { value: "openai", label: "OpenAI", available: true },
        { value: "gemini", label: "Google Gemini", available: true }
      ]);
      expect(options.credentials).toHaveLength(1);
      expect(options.credentials[0].maskedKey).toBe("sk-...XXX");
      expect(options.credentials[0]).not.toHaveProperty("apiKeyEncrypted");
      expect(options.connections).toHaveLength(2);
      expect(options.connections.find(c => c.ref === "9")!.selected).toBe(true);
      expect(options.connections.find(c => c.ref === "10")!.eligible).toBe(true);
    });

    it("8. credential from other tenant not shown", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockCredFindAll.mockResolvedValue([makeCred({ companyId: 10 })]);
      const options = await GetAiAgentProductConfigurationOptionsService({
        companyId: 10,
        req: adminReq()
      });
      expect(mockCredFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 10 } })
      );
      expect(options.credentials.every(c => c.ref === "5")).toBe(true);
    });

    it("8b. connection assigned to other agent → ineligible", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent({ id: 1 })]);
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 11, aiAgentId: 99, name: "Outro" })
      ]);
      const options = await GetAiAgentProductConfigurationOptionsService({
        companyId: 10,
        req: adminReq()
      });
      expect(options.connections[0].eligible).toBe(false);
      expect(options.connections[0].ineligibleReason).toBe("already_assigned");
    });
  });

  describe("POST create", () => {
    it("9. valid → created: true, enabled: false", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({ id: 42, enabled: false });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);

      const result = await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Novo Bot" }
      });

      expect(result.created).toBe(true);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 10,
          name: "Novo Bot",
          enabled: false
        }),
        expect.any(Object)
      );
      expect(result.configuration!.identity.name).toBe("Bot");
    });

    it("10. with profile fields", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({ id: 42 });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);

      await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Bot", ...baseProfileBody }
      });

      expect(mockUpsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 10,
          aiAgentId: 42,
          body: expect.objectContaining({ companyName: "Acme" })
        })
      );
    });

    it("11. with credentialRef", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({ id: 42 });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);
      mockParseCred.mockResolvedValue(5);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));

      await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Bot", credentialRef: "5" }
      });

      expect(mockParseCred).toHaveBeenCalledWith(10, "5");
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ aiProviderCredentialId: 5 }),
        expect.any(Object)
      );
    });

    it("12. with connectionRefs", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({ id: 42 });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);
      const wa = makeWa({ id: 9, aiAgentId: null });
      mockWaFindAll.mockResolvedValue([wa]);

      await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Bot", connectionRefs: ["9"] }
      });

      expect(wa.update).toHaveBeenCalledWith(
        expect.objectContaining({
          aiAgentId: 42,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        }),
        expect.any(Object)
      );
    });

    it("13. agente existe → 409", async () => {
      mockAgentFindAll.mockResolvedValue([makeAgent()]);
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_ALREADY_EXISTS",
        statusCode: 409
      });
      expect(mockTx).not.toHaveBeenCalled();
    });

    it("14. ambiguous → 409", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1 }),
        makeAgent({ id: 2 })
      ]);
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        statusCode: 409
      });
    });

    it("15. rejects companyId in body", async () => {
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot", companyId: 99 }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
      });
    });

    it("16. rejects enabled in body", async () => {
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot", enabled: true }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
      });
    });

    it("17. rejects apiKey in body", async () => {
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot", apiKey: "sk-secret" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
      });
    });
  });

  describe("PUT update", () => {
    it("18. identity changes", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([]);

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Renomeado", description: "Nova desc" }
      });

      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Renomeado",
          description: "Nova desc"
        }),
        expect.any(Object)
      );
      expect(result.changed).toBe(true);
    });

    it("19. model changes when off", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([]);

      await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { model: "gpt-4o", temperature: 0.5, maxTokens: 1024 }
      });

      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          temperature: 0.5,
          maxTokens: 1024
        }),
        expect.any(Object)
      );
    });

    it("20. profile changes when off", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([]);
      mockProfileFindOne.mockResolvedValue(null);

      await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { ...baseProfileBody }
      });

      expect(mockUpsertProfile).toHaveBeenCalled();
    });

    it("21. credential change when off", async () => {
      const agent = makeAgent({
        enabled: false,
        aiProviderCredentialId: null
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([]);
      mockParseCred.mockResolvedValue(5);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));

      await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { credentialRef: "5" }
      });

      expect(mockParseCred).toHaveBeenCalledWith(10, "5");
      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiProviderCredentialId: 5 }),
        expect.any(Object)
      );
    });

    it("22. structural while active → 409", async () => {
      const agent = makeAgent({ enabled: true });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockWaFindAll.mockResolvedValue([
        makeWa({ aiAgentId: 1, aiAgentMode: "live", aiAgentEnabled: true })
      ]);

      await expect(
        UpdateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { model: "gpt-4o" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        statusCode: 409
      });
    });

    it("23. identity while active → ok", async () => {
      const agent = makeAgent({ enabled: true, name: "Old" });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([
        makeWa({ aiAgentId: 1, aiAgentMode: "shadow", aiAgentEnabled: true })
      ]);

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Still Ok", fallbackMessage: "Novo fallback" }
      });

      expect(result.changed).toBe(true);
      expect(agent.update).toHaveBeenCalled();
    });

    it("24. no-op → changed: false", async () => {
      const agent = makeAgent({
        enabled: false,
        name: "Bot",
        description: "Desc"
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([]);

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Bot", description: "Desc" }
      });

      expect(result.changed).toBe(false);
      expect(agent.update).not.toHaveBeenCalled();
    });

    it("25. ambiguous → 409", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ id: 1 }),
        makeAgent({ id: 2 })
      ]);
      await expect(
        UpdateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "X" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        statusCode: 409
      });
    });
  });

  describe("PUT connections", () => {
    it("26. link new", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll
        .mockResolvedValueOnce([agent])
        .mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      const free = makeWa({ id: 9, aiAgentId: null });
      mockWaFindAll
        .mockResolvedValueOnce([free])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([free])
        .mockResolvedValue([makeWa({ id: 9, aiAgentId: 1 })]);

      const result = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        body: { connectionRefs: ["9"] }
      });

      expect(result.changed).toBe(true);
      expect(free.update).toHaveBeenCalledWith(
        expect.objectContaining({
          aiAgentId: 1,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        }),
        expect.any(Object)
      );
    });

    it("27. unlink", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      const linked = makeWa({ id: 9, aiAgentId: 1 });
      // pre-validate desired=[] → empty; current linked → remove
      mockWaFindAll
        .mockResolvedValueOnce([]) // resolveWhatsappsByRefs desired empty (skipped)
        .mockResolvedValueOnce([linked]) // currentLinked in tx
        .mockResolvedValueOnce([]) // desired in tx
        .mockResolvedValue([]); // load configuration

      // desired refs empty — resolveWhatsappsByRefs returns [] without findAll when refs=[]
      // First call outside tx: resolveWhatsappsByRefs with [] → no findAll
      // So first findAll is currentLinked inside tx

      mockWaFindAll.mockReset();
      mockWaFindAll
        .mockResolvedValueOnce([linked]) // currentLinked
        .mockResolvedValueOnce([]) // load config linked
        .mockResolvedValue([]);

      // Re-setup agent find for load
      mockCredFindOne.mockResolvedValue(null);
      mockProfileFindOne.mockResolvedValue(null);

      // Need careful ordering: no pre-validate findAll for empty refs
      const result = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        body: { connectionRefs: [] }
      });

      expect(result.changed).toBe(true);
      expect(linked.update).toHaveBeenCalledWith(
        expect.objectContaining({
          aiAgentId: null,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        }),
        expect.any(Object)
      );
    });

    it("28. already assigned to other → 409", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockWaFindAll.mockResolvedValue([
        makeWa({ id: 9, aiAgentId: 99 })
      ]);

      await expect(
        UpdateAiAgentProductConnectionsService({
          companyId: 10,
          req: adminReq(),
          body: { connectionRefs: ["9"] }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED",
        statusCode: 409
      });
    });

    it("29. cross-tenant → 400", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockWaFindAll.mockResolvedValue([]); // not found for company

      await expect(
        UpdateAiAgentProductConnectionsService({
          companyId: 10,
          req: adminReq(),
          body: { connectionRefs: ["999"] }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONNECTION_INVALID",
        statusCode: 400
      });
    });

    it("30. active → 409", async () => {
      const agent = makeAgent({ enabled: true });
      mockAgentFindAll.mockResolvedValue([agent]);
      const wa = makeWa({
        id: 9,
        aiAgentId: 1,
        aiAgentMode: "live",
        aiAgentEnabled: true
      });
      mockWaFindAll
        .mockResolvedValueOnce([wa]) // pre-validate desired
        .mockResolvedValueOnce([wa]); // currentLinked

      await expect(
        UpdateAiAgentProductConnectionsService({
          companyId: 10,
          req: adminReq(),
          body: { connectionRefs: ["9"] }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        statusCode: 409
      });
    });

    it("31. idempotent", async () => {
      const agent = makeAgent({ enabled: false });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      const linked = makeWa({ id: 9, aiAgentId: 1 });
      mockWaFindAll
        .mockResolvedValueOnce([linked]) // pre-validate
        .mockResolvedValueOnce([linked]) // currentLinked
        .mockResolvedValueOnce([linked]) // desired in tx
        .mockResolvedValue([linked]); // load config

      const result = await UpdateAiAgentProductConnectionsService({
        companyId: 10,
        req: adminReq(),
        body: { connectionRefs: ["9"] }
      });

      expect(result.changed).toBe(false);
      expect(linked.update).not.toHaveBeenCalled();
    });
  });

  describe("serializer", () => {
    it("32. no forbidden keys in response", () => {
      const configuration = serializeAiAgentProductConfiguration({
        identity: { name: "Bot", description: null },
        messages: { fallbackMessage: null, handoffMessage: null },
        model: { name: "gpt-4o-mini", temperature: 0.3, maxTokens: 512 },
        profile: null,
        instructions: { configured: true, preview: "preview only" },
        provider: { configured: true, type: "openai", label: "OpenAI" },
        credential: {
          configured: true,
          label: "Cred",
          maskedKey: "sk-...XXX"
        },
        connections: [
          { ref: "9", name: "WA", status: "CONNECTED", selected: true }
        ]
      });

      const result = serializeAiAgentProductConfigurationResult({
        changed: true,
        configuration,
        summary: summaryPayload() as any
      });

      const json = JSON.stringify(result);
      expect(json).not.toMatch(/apiKeyEncrypted/i);
      expect(json).not.toMatch(/systemPrompt/i);
      expect(json).not.toMatch(/generatedPrompt/i);
      expect(json).not.toMatch(/"companyId"/);
      expect(configuration.instructions.preview).toBe("preview only");
      expect(configuration.model.maxTokens).toBe(512);
    });

    it("32b. preview truncates to 200", () => {
      const long = "X".repeat(300);
      const configuration = serializeAiAgentProductConfiguration({
        identity: { name: "Bot", description: null },
        messages: { fallbackMessage: null, handoffMessage: null },
        model: { name: "gpt-4o-mini", temperature: 0.3, maxTokens: 512 },
        profile: null,
        instructions: { configured: true, preview: long },
        provider: { configured: false, type: null, label: null },
        credential: { configured: false, label: null, maskedKey: null },
        connections: []
      });
      expect(configuration.instructions.preview!.length).toBe(200);
    });
  });

  describe("concurrency", () => {
    it("33. agent resolved under lock on create", async () => {
      mockAgentFindAll
        .mockResolvedValueOnce([]) // pre-check
        .mockResolvedValueOnce([makeAgent()]); // under lock → already exists
      mockAgentCreate.mockResolvedValue(makeAgent({ id: 42 }));

      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "Bot" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_ALREADY_EXISTS"
      });
      expect(mockTx).toHaveBeenCalled();
      expect(mockAgentCreate).not.toHaveBeenCalled();
    });

    it("33b. agent resolved under lock on update → ambiguous", async () => {
      const agent = makeAgent({ id: 1 });
      mockAgentFindAll
        .mockResolvedValueOnce([agent]) // pre
        .mockResolvedValueOnce([agent, makeAgent({ id: 2 })]); // under lock

      await expect(
        UpdateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "X" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS"
      });
    });
  });
});
