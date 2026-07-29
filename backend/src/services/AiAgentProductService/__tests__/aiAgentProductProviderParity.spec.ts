/**
 * Hardening 2.3.1 — paridade comercial OpenAI / Gemini.
 */
import AppError from "../../../errors/AppError";
import GetAiAgentProductConfigurationService from "../GetAiAgentProductConfigurationService";
import GetAiAgentProductConfigurationOptionsService from "../GetAiAgentProductConfigurationOptionsService";
import CreateAiAgentProductConfigurationService from "../CreateAiAgentProductConfigurationService";
import UpdateAiAgentProductConfigurationService from "../UpdateAiAgentProductConfigurationService";
import {
  AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES,
  isAiAgentProductSupportedProvider,
  listAiAgentProductProviderOptions,
  parseCommercialModelForProvider,
  parseCommercialProvider,
  resolveCommercialProviderPresentation
} from "../aiAgentProductProviderCapabilities";
import { serializeAiAgentProductConfiguration } from "../serializeAiAgentProduct";

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

import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import AiProviderCredential from "../../../models/AiProviderCredential";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductSummaryService, {
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";
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
const mockParseCred = parseAiProviderCredentialId as jest.Mock;

function summaryPayload(partial: Record<string, unknown> = {}) {
  return {
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "ready_to_activate",
    mode: "off",
    agent: { exists: true, id: 1, name: "Bot", enabled: false },
    connection: { linked: true, name: "WA", connected: true },
    connectionScope: {
      type: "all_linked",
      count: 1,
      connectedCount: 1,
      disconnectedCount: 0,
      names: ["WA"]
    },
    agentScope: { type: "single", count: 1 },
    readiness: {
      ready: true,
      status: "ready_to_activate",
      mode: "off",
      nextAction: "activate_shadow",
      checks: []
    },
    ...partial
  };
}

function adminReq() {
  return { user: { id: 1, profile: "admin", companyId: 10 } } as never;
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 1,
    companyId: 10,
    name: "Bot",
    description: null,
    enabled: false,
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt: null,
    fallbackMessage: null,
    handoffMessage: null,
    aiProviderCredentialId: null,
    update: jest.fn(async function update(this: Record<string, unknown>, patch: Record<string, unknown>) {
      Object.assign(this, patch);
      return this;
    }),
    ...overrides
  };
  return row;
}

function makeCred(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    companyId: 10,
    name: "Cred OpenAI",
    provider: "openai",
    apiKeyMasked: "sk-...XXX",
    apiKeyEncrypted: "ENCRYPTED",
    enabled: true,
    isDefault: true,
    ...overrides
  };
}

describe("aiAgentProductProviderParity (2.3.1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSummary.mockResolvedValue(summaryPayload());
    mockProfileFindOne.mockResolvedValue(null);
    mockWaFindAll.mockResolvedValue([]);
    mockCredFindAll.mockResolvedValue([]);
    mockCredFindOne.mockResolvedValue(null);
  });

  describe("fonte única", () => {
    it("lista openai e gemini com capabilities Shadow/Live", () => {
      expect(AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES).toHaveLength(2);
      expect(AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES.map(c => c.provider)).toEqual([
        "openai",
        "gemini"
      ]);
      for (const c of AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES) {
        expect(c.available).toBe(true);
        expect(c.supportsShadow).toBe(true);
        expect(c.supportsLive).toBe(true);
        expect(c.requiresCredential).toBe(true);
      }
      expect(listAiAgentProductProviderOptions()).toEqual([
        { value: "openai", label: "OpenAI", available: true, unavailableReason: null },
        {
          value: "gemini",
          label: "Google Gemini",
          available: true,
          unavailableReason: null
        }
      ]);
    });

    it("não converte provider desconhecido para openai", () => {
      expect(isAiAgentProductSupportedProvider("claude")).toBe(false);
      const presentation = resolveCommercialProviderPresentation("claude");
      expect(presentation.type).toBe("claude");
      expect(presentation.label).toBe("Não suportado");
      expect(presentation.supported).toBe(false);
      expect(presentation.type).not.toBe("openai");
    });

    it("rejeita modelo gpt com gemini e gemini com openai", () => {
      expect(() =>
        parseCommercialModelForProvider("gpt-4o-mini", "gemini")
      ).toThrow(AppError);
      expect(() =>
        parseCommercialModelForProvider("gemini-2.5-flash", "openai")
      ).toThrow(AppError);
      expect(parseCommercialModelForProvider("gemini-2.5-flash", "gemini")).toBe(
        "gemini-2.5-flash"
      );
      expect(parseCommercialProvider("gemini")).toBe("gemini");
      expect(() => parseCommercialProvider("claude")).toThrow(AppError);
    });
  });

  describe("GET options", () => {
    it("lista OpenAI e Gemini com labels corretos e sem detalhes técnicos", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockCredFindAll.mockResolvedValue([
        makeCred(),
        makeCred({
          id: 6,
          name: "Cred Gemini",
          provider: "gemini",
          apiKeyMasked: "AIza...YYY",
          isDefault: false
        })
      ]);

      const options = await GetAiAgentProductConfigurationOptionsService({
        companyId: 10,
        req: adminReq()
      });

      expect(options.providers).toEqual([
        { value: "openai", label: "OpenAI", available: true },
        { value: "gemini", label: "Google Gemini", available: true }
      ]);
      expect(options.credentials.map(c => c.provider).sort()).toEqual([
        "gemini",
        "openai"
      ]);
      const json = JSON.stringify(options);
      expect(json).not.toContain("ENCRYPTED");
      expect(json).not.toContain("apiKeyEncrypted");
      expect(json).not.toContain("endpoint");
      expect(json).not.toContain("sdk");
    });
  });

  describe("GET configuration", () => {
    it("agente OpenAI preserva provider/label/modelo", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({
          model: "gpt-4o",
          aiProviderCredentialId: 5
        })
      ]);
      mockAgentFindOne.mockResolvedValue(
        makeAgent({
          model: "gpt-4o",
          aiProviderCredentialId: 5
        })
      );
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });

      expect(result.configuration!.provider).toEqual({
        configured: true,
        type: "openai",
        label: "OpenAI"
      });
      expect(result.configuration!.model.name).toBe("gpt-4o");
      expect(result.configuration!.credential.maskedKey).toBe("sk-...XXX");
    });

    it("agente Gemini preserva provider/label/modelo — não vira openai", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({
          model: "gemini-2.5-flash",
          aiProviderCredentialId: 6
        })
      ]);
      mockAgentFindOne.mockResolvedValue(
        makeAgent({
          model: "gemini-2.5-flash",
          aiProviderCredentialId: 6
        })
      );
      mockCredFindOne.mockResolvedValue(
        makeCred({
          id: 6,
          name: "Gemini Prod",
          provider: "gemini",
          apiKeyMasked: "AIza...ZZZ"
        })
      );

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });

      expect(result.configuration!.provider.type).toBe("gemini");
      expect(result.configuration!.provider.label).toBe("Google Gemini");
      expect(result.configuration!.provider.type).not.toBe("openai");
      expect(result.configuration!.model.name).toBe("gemini-2.5-flash");
      expect(result.configuration!.credential.label).toBe("Gemini Prod");
    });

    it("provider desconhecido não é normalizado para openai", async () => {
      mockAgentFindAll.mockResolvedValue([
        makeAgent({ aiProviderCredentialId: 7 })
      ]);
      mockAgentFindOne.mockResolvedValue(
        makeAgent({ aiProviderCredentialId: 7 })
      );
      mockCredFindOne.mockResolvedValue(
        makeCred({
          id: 7,
          name: "Legado",
          provider: "claude",
          apiKeyMasked: "***"
        })
      );

      const result = await GetAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq()
      });

      expect(result.configuration!.provider.type).toBe("claude");
      expect(result.configuration!.provider.label).toBe("Não suportado");
      expect(result.configuration!.provider.type).not.toBe("openai");
    });
  });

  describe("POST create", () => {
    it("cria com OpenAI válido", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({ id: 42, model: "gpt-4o-mini" });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);
      mockParseCred.mockResolvedValue(5);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));

      const result = await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: {
          name: "Bot OpenAI",
          provider: "openai",
          credentialRef: "5",
          model: "gpt-4o-mini"
        }
      });

      expect(result.created).toBe(true);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          model: "gpt-4o-mini",
          aiProviderCredentialId: 5
        }),
        expect.anything()
      );
    });

    it("cria com Gemini válido e modelo default Gemini", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      const created = makeAgent({
        id: 43,
        model: "gemini-2.5-flash",
        aiProviderCredentialId: 6
      });
      mockAgentCreate.mockResolvedValue(created);
      mockAgentFindOne.mockResolvedValue(created);
      mockParseCred.mockResolvedValue(6);
      mockCredFindOne.mockResolvedValue(
        makeCred({ id: 6, provider: "gemini", name: "G" })
      );

      const result = await CreateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: {
          name: "Bot Gemini",
          provider: "gemini",
          credentialRef: "6"
        }
      });

      expect(result.created).toBe(true);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          model: "gemini-2.5-flash",
          aiProviderCredentialId: 6
        }),
        expect.anything()
      );
    });

    it("rejeita provider inválido", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "X", provider: "claude" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID"
      });
    });

    it("rejeita OpenAI + credencial Gemini", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockParseCred.mockResolvedValue(6);
      mockCredFindOne.mockResolvedValue(
        makeCred({ id: 6, provider: "gemini" })
      );

      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: {
            name: "X",
            provider: "openai",
            credentialRef: "6"
          }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID"
      });
    });

    it("rejeita Gemini + modelo gpt-*", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockParseCred.mockResolvedValue(6);
      mockCredFindOne.mockResolvedValue(
        makeCred({ id: 6, provider: "gemini" })
      );

      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: {
            name: "X",
            provider: "gemini",
            credentialRef: "6",
            model: "gpt-4o-mini"
          }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID"
      });
    });

    it("rejeita credencial cross-tenant", async () => {
      mockAgentFindAll.mockResolvedValue([]);
      mockParseCred.mockRejectedValue(
        new AppError("ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND", 404, "not found")
      );

      await expect(
        CreateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { name: "X", credentialRef: "999" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID"
      });
    });
  });

  describe("PUT update", () => {
    it("troca openai → gemini com credencial e modelo compatíveis", async () => {
      const agent = makeAgent({
        id: 1,
        enabled: false,
        model: "gpt-4o-mini",
        aiProviderCredentialId: 5
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockParseCred.mockResolvedValue(6);
      mockCredFindOne.mockImplementation(async (opts: { where: Record<string, unknown> }) => {
        if (opts.where.id === 6) {
          return makeCred({ id: 6, provider: "gemini", name: "G" });
        }
        if (opts.where.id === 5) {
          return makeCred({ id: 5, provider: "openai" });
        }
        return null;
      });
      mockAgentFindOne.mockResolvedValue(
        makeAgent({
          id: 1,
          model: "gemini-2.5-flash",
          aiProviderCredentialId: 6
        })
      );

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: {
          provider: "gemini",
          credentialRef: "6",
          model: "gemini-2.5-flash"
        }
      });

      expect(result.changed).toBe(true);
      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-flash" }),
        expect.anything()
      );
      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiProviderCredentialId: 6 }),
        expect.anything()
      );
    });

    it("mesma configuração → changed: false", async () => {
      const agent = makeAgent({
        id: 1,
        enabled: false,
        model: "gpt-4o-mini",
        aiProviderCredentialId: 5,
        name: "Bot"
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));
      mockAgentFindOne.mockResolvedValue(agent);

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { name: "Bot" }
      });

      expect(result.changed).toBe(false);
    });

    it("troca de provider enquanto ativo → bloqueada", async () => {
      const agent = makeAgent({
        id: 1,
        enabled: true,
        model: "gpt-4o-mini",
        aiProviderCredentialId: 5
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockWaFindAll.mockResolvedValue([
        {
          id: 9,
          name: "WA",
          status: "CONNECTED",
          aiAgentId: 1,
          aiAgentMode: "live",
          aiAgentEnabled: true
        }
      ]);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5 }));

      await expect(
        UpdateAiAgentProductConfigurationService({
          companyId: 10,
          req: adminReq(),
          body: { provider: "gemini" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE"
      });
    });

    it("provider gemini sem credencial compatível limpa credencial (setup_incomplete)", async () => {
      const agent = makeAgent({
        id: 1,
        enabled: false,
        model: "gpt-4o-mini",
        aiProviderCredentialId: 5
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockCredFindOne.mockResolvedValue(makeCred({ id: 5, provider: "openai" }));
      mockAgentFindOne.mockResolvedValue(
        makeAgent({
          id: 1,
          model: "gemini-2.5-flash",
          aiProviderCredentialId: null
        })
      );

      const result = await UpdateAiAgentProductConfigurationService({
        companyId: 10,
        req: adminReq(),
        body: { provider: "gemini" }
      });

      expect(result.changed).toBe(true);
      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-flash" }),
        expect.anything()
      );
      expect(agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ aiProviderCredentialId: null }),
        expect.anything()
      );
    });
  });

  describe("serializer / segurança", () => {
    it("não vaza secrets nem normaliza Gemini", () => {
      const out = serializeAiAgentProductConfiguration({
        identity: { name: "G", description: null },
        messages: { fallbackMessage: null, handoffMessage: null },
        model: { name: "gemini-2.5-flash", temperature: 0.3, maxTokens: 512 },
        profile: null,
        instructions: { configured: true, preview: "oi" },
        provider: {
          configured: true,
          type: "gemini",
          label: "Google Gemini"
        },
        credential: {
          configured: true,
          label: "G",
          maskedKey: "AIza...YYY"
        },
        connections: []
      });
      expect(out.provider.type).toBe("gemini");
      const json = JSON.stringify(out);
      expect(json).not.toContain("apiKeyEncrypted");
      expect(json).not.toContain("secret");
      expect(json).not.toContain("companyId");
    });
  });
});
