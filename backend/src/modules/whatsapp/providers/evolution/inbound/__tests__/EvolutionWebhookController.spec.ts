/* eslint-disable import/first */
const findByPkWhatsapp = jest.fn();
const processWebhook = jest.fn();
const verifyApiKey = jest.fn();
const extractApiKey = jest.fn();

jest.mock("../../../../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: (...a: unknown[]) => findByPkWhatsapp(...a) }
}));

jest.mock("../processEvolutionWebhook", () => ({
  processEvolutionWebhook: (...a: unknown[]) => processWebhook(...a)
}));

jest.mock("../evolutionWebhookAuth", () => ({
  extractEvolutionWebhookApiKey: (...a: unknown[]) => extractApiKey(...a),
  verifyEvolutionWebhookApiKey: (...a: unknown[]) => verifyApiKey(...a)
}));

import { receive } from "../../../../../../controllers/EvolutionWebhookController";
import AppError from "../../../../../../errors/AppError";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("EvolutionWebhookController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    extractApiKey.mockReturnValue("secret-key");
    verifyApiKey.mockResolvedValue({ ok: true });
    processWebhook.mockResolvedValue({ outcome: "processed" });
  });

  it("rejeita conexão Baileys no endpoint Evolution", async () => {
    findByPkWhatsapp.mockResolvedValue({
      id: 1,
      companyId: 9,
      connectionProvider: "baileys"
    });
    const req = {
      params: { whatsappId: "1" },
      headers: {},
      body: { event: "MESSAGES_UPSERT" }
    } as never;
    await expect(receive(req, mockRes())).rejects.toBeInstanceOf(AppError);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it("rejeita conexão inexistente", async () => {
    findByPkWhatsapp.mockResolvedValue(null);
    await expect(
      receive(
        { params: { whatsappId: "99" }, headers: {}, body: {} } as never,
        mockRes()
      )
    ).rejects.toMatchObject({ message: "ERR_NO_WAPP_FOUND" });
  });

  it("rejeita auth incorreta", async () => {
    findByPkWhatsapp.mockResolvedValue({
      id: 2,
      companyId: 1,
      connectionProvider: "evolution"
    });
    verifyApiKey.mockResolvedValue({ ok: false, reason: "apikey_mismatch" });
    await expect(
      receive(
        {
          params: { whatsappId: "2" },
          headers: { apikey: "wrong" },
          body: { event: "MESSAGES_UPSERT" }
        } as never,
        mockRes()
      )
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_WEBHOOK_UNAUTHORIZED" });
  });

  it("rejeita webhook sem auth", async () => {
    findByPkWhatsapp.mockResolvedValue({
      id: 2,
      companyId: 1,
      connectionProvider: "evolution"
    });
    extractApiKey.mockReturnValue(null);
    verifyApiKey.mockResolvedValue({ ok: false, reason: "missing_apikey" });
    await expect(
      receive(
        {
          params: { whatsappId: "2" },
          headers: {},
          body: { event: "MESSAGES_UPSERT" }
        } as never,
        mockRes()
      )
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_WEBHOOK_UNAUTHORIZED" });
  });

  it("rejeita payload inválido (body não-objeto)", async () => {
    findByPkWhatsapp.mockResolvedValue({
      id: 3,
      companyId: 1,
      connectionProvider: "evolution"
    });
    await expect(
      receive(
        {
          params: { whatsappId: "3" },
          headers: { apikey: "ok" },
          body: "not-json-object"
        } as never,
        mockRes()
      )
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_WEBHOOK_INVALID_PAYLOAD" });
    expect(processWebhook).not.toHaveBeenCalled();
  });
});
