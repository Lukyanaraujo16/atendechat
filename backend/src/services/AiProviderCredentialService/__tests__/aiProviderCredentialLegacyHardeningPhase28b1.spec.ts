import AppError from "../../../errors/AppError";
import DeleteAiProviderCredentialService, {
  ERR_AI_PROVIDER_CREDENTIAL_IN_USE,
  ERR_AI_PROVIDER_CREDENTIAL_IN_USE_BY_KNOWLEDGE
} from "../DeleteAiProviderCredentialService";
import UpdateAiProviderCredentialService from "../UpdateAiProviderCredentialService";
import ListAiProviderCredentialsService from "../ListAiProviderCredentialsService";
import {
  assertNoEnabledInLegacyCredentialPayload,
  ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API
} from "../assertNoEnabledInLegacyCredentialPayload";

jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn()
  }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: {
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeEmbeddingSettings", () => ({
  __esModule: true,
  default: {
    count: jest.fn()
  }
}));

jest.mock("../clearOtherDefaultCredentials", () => ({
  clearOtherDefaultCredentials: jest.fn()
}));

jest.mock("../../../helpers/aiProviderCredentialCrypto", () => ({
  encryptAiProviderApiKey: jest.fn(() => "enc-new")
}));

jest.mock("../../../helpers/maskSecret", () => ({
  maskSecret: jest.fn(() => "sk-…MASK")
}));

import AiProviderCredential from "../../../models/AiProviderCredential";
import AiAgent from "../../../models/AiAgent";
import AiKnowledgeEmbeddingSettings from "../../../models/AiKnowledgeEmbeddingSettings";
import { clearOtherDefaultCredentials } from "../clearOtherDefaultCredentials";
import { encryptAiProviderApiKey } from "../../../helpers/aiProviderCredentialCrypto";

const mockFindOne = AiProviderCredential.findOne as jest.Mock;
const mockFindAll = AiProviderCredential.findAll as jest.Mock;
const mockDestroy = AiProviderCredential.destroy as jest.Mock;
const mockAgentCount = AiAgent.count as jest.Mock;
const mockKbCount = AiKnowledgeEmbeddingSettings.count as jest.Mock;
const mockClearDefaults = clearOtherDefaultCredentials as jest.Mock;

function makeRow(partial: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 7,
    companyId: 10,
    name: "Cred A",
    provider: "openai",
    apiKeyEncrypted: "enc",
    apiKeyMasked: "sk-…901",
    enabled: true,
    isDefault: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
    }),
    reload: jest.fn(async function reload(this: any) {
      return this;
    }),
    ...partial
  };
  return row;
}

describe("Fase 2.8B.1 — hardening legado AiProviderCredential", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DeleteAiProviderCredentialService", () => {
    it("exclui credencial sem vínculo em AiAgent nem Knowledge", async () => {
      mockFindOne.mockResolvedValue(makeRow());
      mockAgentCount.mockResolvedValue(0);
      mockKbCount.mockResolvedValue(0);
      mockDestroy.mockResolvedValue(1);

      const result = await DeleteAiProviderCredentialService({
        companyId: 10,
        id: 7
      });

      expect(result).toEqual({ success: true });
      expect(mockFindOne).toHaveBeenCalledWith({
        where: { id: 7, companyId: 10 }
      });
      expect(mockAgentCount).toHaveBeenCalledWith({
        where: { companyId: 10, aiProviderCredentialId: 7 }
      });
      expect(mockKbCount).toHaveBeenCalledWith({
        where: { companyId: 10, credentialId: 7 }
      });
      expect(mockDestroy).toHaveBeenCalledWith({
        where: { id: 7, companyId: 10 }
      });
    });

    it("bloqueia exclusão quando vinculada a AiAgent", async () => {
      mockFindOne.mockResolvedValue(makeRow());
      mockAgentCount.mockResolvedValue(2);

      await expect(
        DeleteAiProviderCredentialService({ companyId: 10, id: 7 })
      ).rejects.toMatchObject({
        message: ERR_AI_PROVIDER_CREDENTIAL_IN_USE,
        statusCode: 400
      });

      expect(mockKbCount).not.toHaveBeenCalled();
      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it("bloqueia exclusão quando usada por AiKnowledgeEmbeddingSettings", async () => {
      mockFindOne.mockResolvedValue(makeRow());
      mockAgentCount.mockResolvedValue(0);
      mockKbCount.mockResolvedValue(1);

      await expect(
        DeleteAiProviderCredentialService({ companyId: 10, id: 7 })
      ).rejects.toMatchObject({
        message: ERR_AI_PROVIDER_CREDENTIAL_IN_USE_BY_KNOWLEDGE,
        statusCode: 400
      });

      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it("bloqueia vínculos mistos (agente + knowledge) sem alterar registros", async () => {
      mockFindOne.mockResolvedValue(makeRow());
      mockAgentCount.mockResolvedValue(1);
      mockKbCount.mockResolvedValue(1);

      await expect(
        DeleteAiProviderCredentialService({ companyId: 10, id: 7 })
      ).rejects.toMatchObject({
        message: ERR_AI_PROVIDER_CREDENTIAL_IN_USE,
        statusCode: 400
      });

      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it("retorna not found para credencial de outro tenant", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        DeleteAiProviderCredentialService({ companyId: 10, id: 99 })
      ).rejects.toMatchObject({
        message: "ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND",
        statusCode: 404
      });

      expect(mockAgentCount).not.toHaveBeenCalled();
      expect(mockKbCount).not.toHaveBeenCalled();
      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it("consulta Knowledge no mesmo tenant (settings de outra empresa não contam)", async () => {
      mockFindOne.mockResolvedValue(makeRow());
      mockAgentCount.mockResolvedValue(0);
      mockKbCount.mockResolvedValue(0);
      mockDestroy.mockResolvedValue(1);

      await DeleteAiProviderCredentialService({ companyId: 10, id: 7 });

      expect(mockKbCount).toHaveBeenCalledWith({
        where: { companyId: 10, credentialId: 7 }
      });
      expect(mockKbCount.mock.calls[0][0].where).not.toEqual(
        expect.objectContaining({ companyId: 99 })
      );
    });
  });

  describe("assertNoEnabledInLegacyCredentialPayload", () => {
    it.each([
      [{ enabled: true }],
      [{ enabled: false }],
      [{ enabled: null }],
      [{ name: "X", enabled: true }]
    ])("rejeita presença de enabled em %j", body => {
      expect(() => assertNoEnabledInLegacyCredentialPayload(body)).toThrow(
        AppError
      );
      try {
        assertNoEnabledInLegacyCredentialPayload(body);
      } catch (err) {
        expect((err as AppError).message).toBe(
          ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API
        );
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it("aceita payload sem propriedade enabled", () => {
      expect(() =>
        assertNoEnabledInLegacyCredentialPayload({ name: "Nova" })
      ).not.toThrow();
    });
  });

  describe("UpdateAiProviderCredentialService", () => {
    it("permite update de name sem enabled", async () => {
      const row = makeRow({ enabled: true });
      mockFindOne.mockResolvedValue(row);

      const result = await UpdateAiProviderCredentialService({
        companyId: 10,
        id: 7,
        body: { name: "Renomeada" }
      });

      expect(row.update).toHaveBeenCalledWith({ name: "Renomeada" });
      expect(result.name).toBe("Renomeada");
      expect(result.enabled).toBe(true);
      expect(result).not.toHaveProperty("apiKey");
      expect(result).not.toHaveProperty("apiKeyEncrypted");
    });

    it("permite update de provider/apiKey conforme contrato", async () => {
      const row = makeRow();
      mockFindOne.mockResolvedValue(row);

      await UpdateAiProviderCredentialService({
        companyId: 10,
        id: 7,
        body: {
          provider: "openai",
          apiKey: "sk-abcdefghijklmnopqrstuvwxyz"
        }
      });

      expect(encryptAiProviderApiKey).toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "openai",
          apiKeyEncrypted: "enc-new",
          apiKeyMasked: "sk-…MASK"
        })
      );
    });

    it.each([
      [{ enabled: true }],
      [{ enabled: false }],
      [{ enabled: null }],
      [{ name: "Deveria mudar", enabled: false }]
    ])("bloqueia payload com enabled %j sem side effects", async body => {
      const row = makeRow();
      mockFindOne.mockResolvedValue(row);

      await expect(
        UpdateAiProviderCredentialService({
          companyId: 10,
          id: 7,
          body
        })
      ).rejects.toMatchObject({
        message: ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API,
        statusCode: 400
      });

      expect(mockFindOne).not.toHaveBeenCalled();
      expect(row.update).not.toHaveBeenCalled();
      expect(mockClearDefaults).not.toHaveBeenCalled();
    });

    it("credencial de outro tenant → not found", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        UpdateAiProviderCredentialService({
          companyId: 10,
          id: 99,
          body: { name: "X" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND",
        statusCode: 404
      });
    });
  });

  describe("ListAiProviderCredentialsService — regressão Knowledge Base", () => {
    it("lista credenciais do tenant com serializer legado (id + maskedKey)", async () => {
      mockFindAll.mockResolvedValue([
        makeRow({ id: 1, name: "A", isDefault: true }),
        makeRow({ id: 2, name: "B", isDefault: false, enabled: false })
      ]);

      const rows = await ListAiProviderCredentialsService({ companyId: 10 });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { companyId: 10 },
        order: [
          ["isDefault", "DESC"],
          ["name", "ASC"]
        ]
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        id: 1,
        name: "A",
        provider: "openai",
        enabled: true,
        isDefault: true,
        maskedKey: "sk-…901"
      });
      expect(rows[0]).not.toHaveProperty("apiKey");
      expect(rows[0]).not.toHaveProperty("apiKeyEncrypted");
      expect(rows[0]).not.toHaveProperty("credentialRef");
    });
  });
});
