import AppError from "../../../errors/AppError";
import CreateAiAgentProductCredentialService from "../CreateAiAgentProductCredentialService";
import UpdateAiAgentProductCredentialService from "../UpdateAiAgentProductCredentialService";
import ListAiAgentProductCredentialsService from "../ListAiAgentProductCredentialsService";
import GetAiAgentProductCredentialService from "../GetAiAgentProductCredentialService";
import EnableAiAgentProductCredentialService from "../EnableAiAgentProductCredentialService";
import DisableAiAgentProductCredentialService from "../DisableAiAgentProductCredentialService";
import TestAiAgentProductCredentialService from "../TestAiAgentProductCredentialService";
import {
  FORBIDDEN_BODY_KEYS,
  encodeCredentialRef,
  parseCredentialRef,
  rejectForbiddenCredentialFields
} from "../aiAgentProductCredentialHelpers";
import * as fs from "fs";
import * as path from "path";

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn()
}));

jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeEmbeddingSettings", () => ({
  __esModule: true,
  default: {
    count: jest.fn()
  }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    count: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../AiProviderCredentialService/CreateAiProviderCredentialService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../AiProviderCredentialService/TestAiProviderCredentialService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../AiProviderCredentialService/clearOtherDefaultCredentials", () => ({
  clearOtherDefaultCredentials: jest.fn()
}));

jest.mock("../../../helpers/aiProviderCredentialCrypto", () => ({
  encryptAiProviderApiKey: jest.fn(() => "enc"),
  decryptAiProviderApiKey: jest.fn(() => "sk-testkey12345678901")
}));

jest.mock("../../../helpers/maskSecret", () => ({
  maskSecret: jest.fn(() => "sk-…901")
}));

import { resolveAiAgentProductAvailability } from "../GetAiAgentProductSummaryService";
import AiProviderCredential from "../../../models/AiProviderCredential";
import AiAgent from "../../../models/AiAgent";
import AiKnowledgeEmbeddingSettings from "../../../models/AiKnowledgeEmbeddingSettings";
import Whatsapp from "../../../models/Whatsapp";
import CreateAiProviderCredentialService from "../../AiProviderCredentialService/CreateAiProviderCredentialService";
import TestAiProviderCredentialService from "../../AiProviderCredentialService/TestAiProviderCredentialService";
import { clearOtherDefaultCredentials } from "../../AiProviderCredentialService/clearOtherDefaultCredentials";
import { encryptAiProviderApiKey } from "../../../helpers/aiProviderCredentialCrypto";
import { maskSecret } from "../../../helpers/maskSecret";

const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockCredFindAll = AiProviderCredential.findAll as jest.Mock;
const mockCredFindOne = AiProviderCredential.findOne as jest.Mock;
const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentCount = AiAgent.count as jest.Mock;
const mockKbCount = AiKnowledgeEmbeddingSettings.count as jest.Mock;
const mockWaCount = Whatsapp.count as jest.Mock;
const mockCreateLegacy = CreateAiProviderCredentialService as jest.Mock;
const mockTestLegacy = TestAiProviderCredentialService as jest.Mock;
const mockClearDefaults = clearOtherDefaultCredentials as jest.Mock;

function allowAccess() {
  mockAvailability.mockResolvedValue({
    enabledByPlan: true,
    accessibleByUser: true
  });
}

function makeCred(partial: Record<string, unknown> = {}) {
  return {
    id: 5,
    companyId: 10,
    name: "Prod Key",
    provider: "openai",
    apiKeyEncrypted: "enc",
    apiKeyMasked: "sk-…901",
    enabled: true,
    isDefault: false,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    reload: jest.fn(async function reload(this: any) {
      return this;
    }),
    ...partial
  };
}

describe("aiAgentProductCredentials (Fase 2.7)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAccess();
    mockAgentCount.mockResolvedValue(0);
    mockAgentFindAll.mockResolvedValue([]);
    mockKbCount.mockResolvedValue(0);
    mockWaCount.mockResolvedValue(0);
  });

  describe("helpers", () => {
    it("encodeCredentialRef matches Options pattern String(id)", () => {
      expect(encodeCredentialRef(42)).toBe("42");
    });

    it("parseCredentialRef rejects non-positive / non-integer strings", () => {
      expect(() => parseCredentialRef("abc")).toThrow(AppError);
      expect(() => parseCredentialRef("0")).toThrow(
        expect.objectContaining({ message: "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID" })
      );
      expect(() => parseCredentialRef("-1")).toThrow(AppError);
      expect(parseCredentialRef("7")).toBe(7);
    });

    it("rejectForbiddenCredentialFields throws 403 for forbidden keys", () => {
      for (const key of FORBIDDEN_BODY_KEYS) {
        expect(() => rejectForbiddenCredentialFields({ [key]: 1 })).toThrow(
          expect.objectContaining({
            message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
            statusCode: 403
          })
        );
      }
    });
  });

  describe("create", () => {
    it("rejects forbidden fields including companyId", async () => {
      await expect(
        CreateAiAgentProductCredentialService({
          companyId: 10,
          body: { companyId: 99, name: "X", provider: "openai", apiKey: "sk-abcdefghij1234567890" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        statusCode: 403
      });
      expect(mockCreateLegacy).not.toHaveBeenCalled();
    });

    it("creates openai credential via legacy create and re-serializes", async () => {
      mockCreateLegacy.mockResolvedValue({
        id: 5,
        name: "OpenAI Prod",
        provider: "openai",
        maskedKey: "sk-…901",
        enabled: true,
        isDefault: false
      });
      const row = makeCred({ name: "OpenAI Prod" });
      mockCredFindOne.mockResolvedValue(row);

      const result = await CreateAiAgentProductCredentialService({
        companyId: 10,
        body: {
          name: "OpenAI Prod",
          provider: "openai",
          apiKey: "sk-abcdefghij1234567890",
          isDefault: true
        }
      });

      expect(mockCreateLegacy).toHaveBeenCalledWith({
        companyId: 10,
        body: expect.objectContaining({
          name: "OpenAI Prod",
          provider: "openai",
          enabled: true,
          isDefault: true
        })
      });
      expect(result).toEqual({
        credentialRef: "5",
        name: "OpenAI Prod",
        provider: "openai",
        maskedKey: "sk-…901",
        enabled: true,
        isDefault: false,
        usage: { aiAgent: false, knowledgeEmbedding: false }
      });
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("companyId");
      expect(result).not.toHaveProperty("apiKeyEncrypted");
    });

    it("creates gemini credential", async () => {
      mockCreateLegacy.mockResolvedValue({
        id: 8,
        name: "Gemini",
        provider: "gemini",
        maskedKey: "AIz…xyz",
        enabled: true,
        isDefault: false
      });
      mockCredFindOne.mockResolvedValue(
        makeCred({
          id: 8,
          name: "Gemini",
          provider: "gemini",
          apiKeyMasked: "AIz…xyz"
        })
      );

      const result = await CreateAiAgentProductCredentialService({
        companyId: 10,
        body: {
          name: "Gemini",
          provider: "gemini",
          apiKey: "AIzaSyDummyKeyForGeminiTests01"
        }
      });

      expect(result.provider).toBe("gemini");
      expect(result.credentialRef).toBe("8");
    });

    it("rejects unsupported provider", async () => {
      await expect(
        CreateAiAgentProductCredentialService({
          companyId: 10,
          body: {
            name: "X",
            provider: "anthropic",
            apiKey: "sk-abcdefghij1234567890"
          }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID"
      });
    });
  });

  describe("list / get", () => {
    it("list returns empty array", async () => {
      mockCredFindAll.mockResolvedValue([]);
      const result = await ListAiAgentProductCredentialsService({
        companyId: 10
      });
      expect(result).toEqual([]);
      expect(mockCredFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 10 },
          order: [
            ["isDefault", "DESC"],
            ["name", "ASC"],
            ["id", "ASC"]
          ]
        })
      );
    });

    it("get other tenant returns same 404", async () => {
      mockCredFindOne.mockResolvedValue(null);
      await expect(
        GetAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5"
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
        statusCode: 404
      });
      expect(mockCredFindOne).toHaveBeenCalledWith({
        where: { id: 5, companyId: 10 }
      });
    });

    it("KB legacy options list can see created credential (mock)", async () => {
      mockCredFindAll.mockResolvedValue([
        makeCred({ id: 5, name: "Visible" })
      ]);
      const list = await ListAiAgentProductCredentialsService({
        companyId: 10
      });
      expect(list).toHaveLength(1);
      expect(list[0].credentialRef).toBe("5");
      // Same underlying AiProviderCredential table — Options uses String(c.id)
      expect(encodeCredentialRef(5)).toBe("5");
    });
  });

  describe("update", () => {
    it("swaps apiKey via encrypt/mask; empty apiKey is absence", async () => {
      const row = makeCred();
      mockCredFindOne.mockResolvedValue(row);

      await UpdateAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5",
        body: { apiKey: "sk-newkeyswap12345678901" }
      });

      expect(encryptAiProviderApiKey).toHaveBeenCalled();
      expect(maskSecret).toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyEncrypted: "enc",
          apiKeyMasked: "sk-…901"
        })
      );

      row.update.mockClear();
      await UpdateAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5",
        body: { apiKey: "" }
      });
      expect(row.update).not.toHaveBeenCalled();
    });

    it("rejects provider change when linked to any agent", async () => {
      mockCredFindOne.mockResolvedValue(makeCred({ provider: "openai" }));
      mockAgentCount.mockResolvedValue(1);

      await expect(
        UpdateAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5",
          body: { provider: "gemini" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_CREDENTIAL_PROVIDER_IN_USE"
      });
    });

    it("allows provider change when not linked", async () => {
      const row = makeCred({ provider: "openai" });
      mockCredFindOne.mockResolvedValue(row);
      mockAgentCount.mockResolvedValue(0);

      await UpdateAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5",
        body: { provider: "gemini" }
      });

      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "gemini" })
      );
    });

    it("rejects enabled in body (forbidden)", async () => {
      await expect(
        UpdateAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5",
          body: { enabled: false }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        statusCode: 403
      });
    });

    it("keeps credentialRef stable and clears other defaults", async () => {
      const row = makeCred({ isDefault: false });
      mockCredFindOne.mockResolvedValue(row);

      const result = await UpdateAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5",
        body: { isDefault: true, name: "Renamed" }
      });

      expect(mockClearDefaults).toHaveBeenCalledWith(10, 5);
      expect(result.credentialRef).toBe("5");
      expect(result.name).toBe("Renamed");
    });
  });

  describe("disable / enable", () => {
    it("allows disable when credential has no agent and no KB", async () => {
      const row = makeCred({ enabled: true });
      mockCredFindOne.mockResolvedValue(row);
      mockKbCount.mockResolvedValue(0);
      mockAgentFindAll.mockResolvedValue([]);

      const result = await DisableAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5"
      });

      expect(row.update).toHaveBeenCalledWith({ enabled: false });
      expect(result.enabled).toBe(false);
      expect(mockWaCount).not.toHaveBeenCalled();
    });

    it("blocks disable when KB embedding uses credential", async () => {
      mockCredFindOne.mockResolvedValue(makeCred());
      mockKbCount.mockResolvedValue(1);

      await expect(
        DisableAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5"
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_CREDENTIAL_KNOWLEDGE_IN_USE"
      });
      expect(mockWaCount).not.toHaveBeenCalled();
    });

    it("allows disable when agent.enabled=true but all connections Off", async () => {
      const row = makeCred({ enabled: true });
      mockCredFindOne.mockResolvedValue(row);
      mockKbCount.mockResolvedValue(0);
      mockAgentFindAll.mockResolvedValue([{ id: 1, enabled: true }]);
      mockWaCount.mockResolvedValue(0);

      const result = await DisableAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5"
      });

      expect(row.update).toHaveBeenCalledWith({ enabled: false });
      expect(result.enabled).toBe(false);
      // Sem efeitos colaterais em agente/vínculo/conexões
      expect(mockAgentFindAll).toHaveBeenCalled();
      expect(mockWaCount).toHaveBeenCalled();
    });

    it("allows disable when only linked to Off agents", async () => {
      const row = makeCred({ enabled: true });
      mockCredFindOne.mockResolvedValue(row);
      mockKbCount.mockResolvedValue(0);
      mockAgentFindAll.mockResolvedValue([{ id: 1, enabled: false }]);
      mockWaCount.mockResolvedValue(0);

      const result = await DisableAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5"
      });

      expect(row.update).toHaveBeenCalledWith({ enabled: false });
      expect(result.enabled).toBe(false);
    });

    it.each([["shadow"], ["live"], ["dry_run"]])(
      "blocks disable when operational WA mode includes %s",
      async () => {
        mockCredFindOne.mockResolvedValue(makeCred());
        mockKbCount.mockResolvedValue(0);
        mockAgentFindAll.mockResolvedValue([{ id: 1, enabled: false }]);
        mockWaCount.mockResolvedValue(1);

        await expect(
          DisableAiAgentProductCredentialService({
            companyId: 10,
            credentialRef: "5"
          })
        ).rejects.toMatchObject({
          message: "ERR_AI_AGENT_CREDENTIAL_ACTIVE_AGENT_IN_USE"
        });
        expect(mockWaCount).toHaveBeenCalled();
      }
    );

    it("blocks disable for mixed Off+active (WA count > 0)", async () => {
      mockCredFindOne.mockResolvedValue(makeCred());
      mockKbCount.mockResolvedValue(0);
      mockAgentFindAll.mockResolvedValue([
        { id: 1, enabled: false },
        { id: 2, enabled: true }
      ]);
      mockWaCount.mockResolvedValue(1);

      await expect(
        DisableAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5"
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_CREDENTIAL_ACTIVE_AGENT_IN_USE"
      });
    });

    it("enable sets enabled=true without side effects", async () => {
      const row = makeCred({ enabled: false });
      mockCredFindOne.mockResolvedValue(row);

      const result = await EnableAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5"
      });

      expect(row.update).toHaveBeenCalledWith({ enabled: true });
      expect(result.enabled).toBe(true);
      expect(mockClearDefaults).not.toHaveBeenCalled();
    });
  });

  describe("test", () => {
    it("returns sanitized commercial success payload", async () => {
      mockCredFindOne.mockResolvedValue(makeCred());
      mockTestLegacy.mockResolvedValue({ ok: true, provider: "openai" });

      const result = await TestAiAgentProductCredentialService({
        companyId: 10,
        credentialRef: "5"
      });

      expect(result).toEqual({
        success: true,
        provider: "openai",
        message: "Credencial validada com sucesso."
      });
      expect(JSON.stringify(result)).not.toMatch(/apiKey|stack|raw/i);
    });

    it("maps provider test failure to commercial message", async () => {
      mockCredFindOne.mockResolvedValue(makeCred());
      mockTestLegacy.mockRejectedValue(
        new AppError(
          "ERR_AI_PROVIDER_TEST_FAILED",
          400,
          "Falha ao validar a credencial com o provedor."
        )
      );

      await expect(
        TestAiAgentProductCredentialService({
          companyId: 10,
          credentialRef: "5"
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
        clientMessage: "Não foi possível validar a credencial com o provedor."
      });
    });
  });

  describe("routes — no DELETE Product endpoint", () => {
    it("aiAgentProductRoutes has credential paths without delete()", () => {
      const routesPath = path.join(
        __dirname,
        "../../../routes/aiAgentProductRoutes.ts"
      );
      const source = fs.readFileSync(routesPath, "utf8");
      expect(source).toContain('/product/ai-agent/credentials');
      expect(source).toContain('/product/ai-agent/credentials/:credentialRef/test');
      expect(source).toContain('/product/ai-agent/credentials/:credentialRef/enable');
      expect(source).toContain('/product/ai-agent/credentials/:credentialRef/disable');
      expect(source).not.toMatch(
        /aiAgentProductRoutes\.delete\(\s*["']\/product\/ai-agent\/credentials/
      );
      expect(source).toMatch(/Sem DELETE/);
    });
  });
});
