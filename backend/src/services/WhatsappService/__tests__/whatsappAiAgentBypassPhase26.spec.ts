import AppError from "../../../errors/AppError";
import {
  assertNoAiAgentFieldsInWhatsappPayload,
  ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API,
  AI_AGENT_WHATSAPP_MUTATION_FIELDS
} from "../assertNoAiAgentFieldsInWhatsappPayload";

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

jest.mock("../ShowWhatsAppService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../AssociateWhatsappQueue", () => ({
  __esModule: true,
  default: jest.fn()
}));

import Whatsapp from "../../../models/Whatsapp";
import Company from "../../../models/Company";
import ShowWhatsAppService from "../ShowWhatsAppService";
import AssociateWhatsappQueue from "../AssociateWhatsappQueue";
import UpdateWhatsAppService from "../UpdateWhatsAppService";
import CreateWhatsAppService from "../CreateWhatsAppService";

describe("Fase 2.6 — anti-bypass AI Agent em WhatsApp create/update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assertNoAiAgentFieldsInWhatsappPayload", () => {
    it.each([
      [{ aiAgentId: 1 }],
      [{ aiAgentMode: "live" }],
      [{ aiAgentEnabled: true }],
      [{ aiAgentId: null }],
      [{ aiAgentMode: "disabled" }],
      [{ aiAgentEnabled: false }],
      [{ aiAgentId: 2, aiAgentMode: "shadow", aiAgentEnabled: true }]
    ])("rejeita payload com campos AI %j", body => {
      expect(() => assertNoAiAgentFieldsInWhatsappPayload(body)).toThrow(
        AppError
      );
      try {
        assertNoAiAgentFieldsInWhatsappPayload(body);
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).message).toBe(
          ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API
        );
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it("aceita payload sem campos AI", () => {
      expect(() =>
        assertNoAiAgentFieldsInWhatsappPayload({ name: "WA", queueIds: [] })
      ).not.toThrow();
    });

    it("lista campos proibidos estável", () => {
      expect([...AI_AGENT_WHATSAPP_MUTATION_FIELDS]).toEqual([
        "aiAgentId",
        "aiAgentMode",
        "aiAgentEnabled"
      ]);
    });
  });

  describe("UpdateWhatsAppService — preservação", () => {
    it("PUT sem campos AI preserva vínculo Live", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const whatsapp = {
        id: 9,
        name: "Antigo",
        companyId: 1,
        aiAgentId: 42,
        aiAgentMode: "live",
        aiAgentEnabled: true,
        update
      };
      (ShowWhatsAppService as jest.Mock).mockResolvedValue(whatsapp);
      (AssociateWhatsappQueue as jest.Mock).mockResolvedValue(undefined);

      await UpdateWhatsAppService({
        whatsappId: "9",
        companyId: 1,
        whatsappData: { name: "Novo Nome", queueIds: [] }
      });

      expect(update).toHaveBeenCalled();
      const patch = update.mock.calls[0][0];
      expect(patch).not.toHaveProperty("aiAgentId");
      expect(patch).not.toHaveProperty("aiAgentMode");
      expect(patch).not.toHaveProperty("aiAgentEnabled");
      expect(patch.name).toBe("Novo Nome");
    });

    it("PUT sem campos AI preserva Shadow", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      (ShowWhatsAppService as jest.Mock).mockResolvedValue({
        id: 9,
        name: "WA",
        companyId: 1,
        aiAgentId: 7,
        aiAgentMode: "shadow",
        aiAgentEnabled: true,
        update
      });
      (AssociateWhatsappQueue as jest.Mock).mockResolvedValue(undefined);

      await UpdateWhatsAppService({
        whatsappId: "9",
        companyId: 1,
        whatsappData: { greetingMessage: "Oi", queueIds: [] }
      });

      const patch = update.mock.calls[0][0];
      expect(patch.aiAgentMode).toBeUndefined();
      expect(patch.aiAgentId).toBeUndefined();
    });

    it("PUT com aiAgentMode rejeita e não chama update", async () => {
      const update = jest.fn();
      (ShowWhatsAppService as jest.Mock).mockResolvedValue({
        id: 9,
        aiAgentMode: "live",
        update
      });

      await expect(
        UpdateWhatsAppService({
          whatsappId: "9",
          companyId: 1,
          whatsappData: {
            name: "X",
            aiAgentMode: "disabled",
            aiAgentEnabled: false,
            queueIds: []
          } as any
        })
      ).rejects.toMatchObject({
        message: ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("PUT com aiAgentId:null rejeita (não remove vínculo)", async () => {
      await expect(
        UpdateWhatsAppService({
          whatsappId: "9",
          companyId: 1,
          whatsappData: { aiAgentId: null, queueIds: [] } as any
        })
      ).rejects.toMatchObject({
        message: ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API
      });
    });

    it("PUT com troca de aiAgentId rejeita", async () => {
      await expect(
        UpdateWhatsAppService({
          whatsappId: "9",
          companyId: 1,
          whatsappData: { aiAgentId: 99, queueIds: [] } as any
        })
      ).rejects.toMatchObject({
        message: ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API
      });
    });
  });

  describe("CreateWhatsAppService — sem campos AI", () => {
    it("POST sem campos AI cria com defaults do model (sem setar AI no create)", async () => {
      (Company.findOne as jest.Mock).mockResolvedValue({
        plan: { connections: 10 }
      });
      (Whatsapp.count as jest.Mock).mockResolvedValue(0);
      (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);
      const created = { id: 1, name: "Nova", token: "abc" };
      (Whatsapp.create as jest.Mock).mockResolvedValue(created);
      (AssociateWhatsappQueue as jest.Mock).mockResolvedValue(undefined);

      const result = await CreateWhatsAppService({
        name: "Nova",
        companyId: 1,
        queueIds: []
      });

      expect(result.whatsapp).toBe(created);
      const createArg = (Whatsapp.create as jest.Mock).mock.calls[0][0];
      expect(createArg).not.toHaveProperty("aiAgentId");
      expect(createArg).not.toHaveProperty("aiAgentMode");
      expect(createArg).not.toHaveProperty("aiAgentEnabled");
    });
  });
});
