/* eslint-disable import/first */
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../AssociateWhatsappQueue", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock(
  "../../../modules/whatsapp/providers/evolution/central/provisionCentralEvolutionCredentials",
  () => ({
    provisionCentralEvolutionCredentials: jest.fn()
  })
);

import AppError from "../../../errors/AppError";
import Whatsapp from "../../../models/Whatsapp";
import Company from "../../../models/Company";
import AssociateWhatsappQueue from "../AssociateWhatsappQueue";
import CreateWhatsAppService from "../CreateWhatsAppService";
import { provisionCentralEvolutionCredentials } from "../../../modules/whatsapp/providers/evolution/central/provisionCentralEvolutionCredentials";
import {
  ERR_EVOLUTION_CENTRAL_CONFIG_MISSING,
  ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED
} from "../../../modules/whatsapp/providers/evolution/evolutionErrors";

describe("CreateWhatsAppService — Evolution central (tenant CREATE)", () => {
  const setupBaileysMocks = () => {
    (Company.findOne as jest.Mock).mockResolvedValue({
      plan: { connections: 10 }
    });
    (Whatsapp.count as jest.Mock).mockResolvedValue(0);
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);
    (AssociateWhatsappQueue as jest.Mock).mockResolvedValue(undefined);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupBaileysMocks();
  });

  describe("auth / provider", () => {
    it("admin tenant cria Evolution e provisiona credencial central", async () => {
      const created = {
        id: 11,
        name: "Evo",
        destroy: jest.fn(),
        connectionProvider: "evolution"
      };
      (Whatsapp.create as jest.Mock).mockResolvedValue(created);
      (provisionCentralEvolutionCredentials as jest.Mock).mockResolvedValue({
        instanceName: "streamhub-c1-w11",
        credential: { whatsappId: 11 }
      });

      const result = await CreateWhatsAppService({
        name: "Evo",
        companyId: 1,
        queueIds: [],
        connectionProvider: "evolution",
        createdByUserId: 50
      });

      expect(result.whatsapp).toBe(created);
      expect(provisionCentralEvolutionCredentials).toHaveBeenCalledWith({
        companyId: 1,
        whatsappId: 11
      });
    });

    it("admin empresa cria Baileys sem provision Evolution", async () => {
      const created = { id: 2, name: "Bai" };
      (Whatsapp.create as jest.Mock).mockResolvedValue(created);
      const result = await CreateWhatsAppService({
        name: "Bai",
        companyId: 1,
        queueIds: [],
        connectionProvider: "baileys",
        createdByUserId: 50
      });
      expect(result.whatsapp).toBe(created);
      expect(provisionCentralEvolutionCredentials).not.toHaveBeenCalled();
    });

    it("provider omitido continua Baileys", async () => {
      const created = { id: 3, name: "Default" };
      (Whatsapp.create as jest.Mock).mockResolvedValue(created);
      await CreateWhatsAppService({
        name: "Default",
        companyId: 1,
        queueIds: []
      });
      const createArg = (Whatsapp.create as jest.Mock).mock.calls[0][0];
      expect(createArg.connectionProvider).toBe("baileys");
    });

    it("persiste companyId autenticado, não um id arbitrário no nome", async () => {
      (Whatsapp.create as jest.Mock).mockResolvedValue({
        id: 44,
        destroy: jest.fn()
      });
      (provisionCentralEvolutionCredentials as jest.Mock).mockResolvedValue({
        instanceName: "streamhub-c19-w44"
      });

      await CreateWhatsAppService({
        name: "Evo",
        companyId: 19,
        queueIds: [],
        connectionProvider: "evolution",
        createdByUserId: 50
      });

      const createArg = (Whatsapp.create as jest.Mock).mock.calls[0][0];
      expect(createArg.companyId).toBe(19);
      expect(provisionCentralEvolutionCredentials).toHaveBeenCalledWith({
        companyId: 19,
        whatsappId: 44
      });
    });
  });

  describe("provisionamento", () => {
    it("rollback destroy whatsapp se provision falhar", async () => {
      const destroy = jest.fn().mockResolvedValue(undefined);
      (Whatsapp.create as jest.Mock).mockResolvedValue({
        id: 99,
        name: "Fail",
        destroy
      });
      (provisionCentralEvolutionCredentials as jest.Mock).mockRejectedValue(
        new AppError(ERR_EVOLUTION_CENTRAL_CONFIG_MISSING, 503)
      );

      await expect(
        CreateWhatsAppService({
          name: "Fail",
          companyId: 1,
          queueIds: [],
          connectionProvider: "evolution",
          createdByUserId: 50
        })
      ).rejects.toMatchObject({
        message: ERR_EVOLUTION_CENTRAL_CONFIG_MISSING
      });
      expect(destroy).toHaveBeenCalled();
      expect(AssociateWhatsappQueue).not.toHaveBeenCalled();
    });

    it("Evolution usa status DISCONNECTED em vez de OPENING", async () => {
      (Whatsapp.create as jest.Mock).mockResolvedValue({
        id: 12,
        destroy: jest.fn()
      });
      (provisionCentralEvolutionCredentials as jest.Mock).mockResolvedValue({
        instanceName: "streamhub-c1-w12"
      });

      await CreateWhatsAppService({
        name: "Evo",
        companyId: 1,
        queueIds: [],
        connectionProvider: "evolution",
        createdByUserId: 50
      });

      const createArg = (Whatsapp.create as jest.Mock).mock.calls[0][0];
      expect(createArg.status).toBe("DISCONNECTED");
      expect(createArg.connectionProvider).toBe("evolution");
    });
  });

  describe("segurança payload", () => {
    it("rejeita baseUrl/apiKey/instanceName do caller", async () => {
      await expect(
        CreateWhatsAppService({
          name: "Evo",
          companyId: 1,
          queueIds: [],
          connectionProvider: "evolution",
          createdByUserId: 50,
          evolution: {
            baseUrl: "https://attacker.evo",
            apiKey: "stolen-key",
            instanceName: "evil"
          }
        })
      ).rejects.toMatchObject({
        message: ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED
      });
      expect(Whatsapp.create).not.toHaveBeenCalled();
      expect(provisionCentralEvolutionCredentials).not.toHaveBeenCalled();
    });

    it("response create não inclui secrets (whatsapp model puro)", async () => {
      (Whatsapp.create as jest.Mock).mockResolvedValue({
        id: 20,
        name: "Safe",
        connectionProvider: "evolution",
        token: "public-token",
        destroy: jest.fn()
      });
      (provisionCentralEvolutionCredentials as jest.Mock).mockResolvedValue({
        instanceName: "streamhub-c1-w20",
        credential: {
          apiKeyEncrypted: "evo1:SECRET",
          apiKeyMasked: "sec••••"
        }
      });

      const { whatsapp } = await CreateWhatsAppService({
        name: "Safe",
        companyId: 1,
        queueIds: [],
        connectionProvider: "evolution",
        createdByUserId: 50
      });

      expect(JSON.stringify(whatsapp)).not.toMatch(/evo1:|SECRET|sec••••/);
      expect(whatsapp).not.toHaveProperty("apiKey");
      expect(whatsapp).not.toHaveProperty("evolution");
    });
  });
});
