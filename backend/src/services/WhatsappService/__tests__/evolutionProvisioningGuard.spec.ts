import { ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED } from "../../../modules/whatsapp/providers/evolution/evolutionErrors";
import {
  assertEvolutionCentralProvisionAllowed,
  hasEvolutionTechnicalPayloadFields
} from "../evolutionProvisioningGuard";

describe("evolutionProvisioningGuard", () => {
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
    it("rejeita payload técnico", async () => {
      await expect(
        assertEvolutionCentralProvisionAllowed({
          createdByUserId: 99,
          evolution: { apiKey: "secret" }
        })
      ).rejects.toMatchObject({
        message: ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED,
        statusCode: 400
      });
    });

    it("permite CREATE Evolution sem payload técnico (auth é a rota)", async () => {
      await expect(
        assertEvolutionCentralProvisionAllowed({ createdByUserId: 50 })
      ).resolves.toBeUndefined();
      await expect(
        assertEvolutionCentralProvisionAllowed({
          createdByUserId: 50,
          evolution: {}
        })
      ).resolves.toBeUndefined();
    });

    it("não usa AppError de provision forbidden neste guard", async () => {
      await expect(
        assertEvolutionCentralProvisionAllowed({ createdByUserId: 99 })
      ).resolves.toBeUndefined();
    });
  });
});
