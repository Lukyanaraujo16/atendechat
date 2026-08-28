jest.mock("../../../helpers/canProvisionEvolutionConnection", () => ({
  canProvisionEvolutionConnection: jest.fn()
}));

import AppError from "../../../errors/AppError";
import { canProvisionEvolutionConnection } from "../../../helpers/canProvisionEvolutionConnection";
import {
  assertEvolutionCentralProvisionAllowed,
  hasEvolutionTechnicalPayloadFields
} from "../evolutionProvisioningGuard";
import {
  ERR_EVOLUTION_PROVISION_FORBIDDEN,
  ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED
} from "../../../modules/whatsapp/providers/evolution/evolutionErrors";

describe("evolutionProvisioningGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hasEvolutionTechnicalPayloadFields", () => {
    it.each([
      [{ baseUrl: "https://x" }],
      [{ instanceName: "i" }],
      [{ apiKey: "k" }],
      [{ instanceId: "id" }]
    ])("detecta campo técnico %j", evolution => {
      expect(hasEvolutionTechnicalPayloadFields(evolution)).toBe(true);
    });

    it("aceita evolution vazio ou omitido", () => {
      expect(hasEvolutionTechnicalPayloadFields(undefined)).toBe(false);
      expect(hasEvolutionTechnicalPayloadFields({})).toBe(false);
    });
  });

  describe("assertEvolutionCentralProvisionAllowed", () => {
    it("rejeita payload técnico antes do gate de perfil", async () => {
      (canProvisionEvolutionConnection as jest.Mock).mockResolvedValue(true);
      await expect(
        assertEvolutionCentralProvisionAllowed({
          createdByUserId: 1,
          evolution: { apiKey: "secret" }
        })
      ).rejects.toMatchObject({
        message: ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED,
        statusCode: 400
      });
      expect(canProvisionEvolutionConnection).not.toHaveBeenCalled();
    });

    it("bloqueia tenant sem permissão Evolution", async () => {
      (canProvisionEvolutionConnection as jest.Mock).mockResolvedValue(false);
      await expect(
        assertEvolutionCentralProvisionAllowed({ createdByUserId: 99 })
      ).rejects.toMatchObject({
        message: ERR_EVOLUTION_PROVISION_FORBIDDEN,
        statusCode: 403
      });
    });

    it("permite Super Admin sem payload técnico", async () => {
      (canProvisionEvolutionConnection as jest.Mock).mockResolvedValue(true);
      await expect(
        assertEvolutionCentralProvisionAllowed({ createdByUserId: 1 })
      ).resolves.toBeUndefined();
    });
  });
});
