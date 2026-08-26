/* eslint-disable import/first */
jest.mock("../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: jest.fn() })
  })
}));

import {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError,
  assertEvolutionTransportNotAvailable,
  startEvolutionWhatsAppSessionPlaceholder
} from "../index";
import { EvolutionWhatsAppOutbound } from "../outbound/EvolutionWhatsAppOutbound";
import {
  ERR_WHATSAPP_PROVIDER_NOT_READY,
  throwEvolutionProviderNotReady
} from "../evolutionErrors";
import AppError from "../../../../../errors/AppError";

describe("Evolution foundation Fase 5", () => {
  it("capacidades de transporte estão desabilitadas", () => {
    expect(EVOLUTION_PHASE5_CAPABILITIES.sendText).toBe(false);
    expect(EVOLUTION_PHASE5_CAPABILITIES.webhookInbound).toBe(false);
    expect(EVOLUTION_PHASE5_CAPABILITIES.connect).toBe(false);
  });

  it("outbound skeleton lança ERR_WHATSAPP_PROVIDER_NOT_READY", async () => {
    const outbound = new EvolutionWhatsAppOutbound();
    expect(outbound.provider).toBe("evolution");
    await expect(
      outbound.sendText({ jid: "x", text: "hi" })
    ).rejects.toMatchObject({ message: ERR_WHATSAPP_PROVIDER_NOT_READY });
  });

  it("assertEvolutionTransportNotAvailable lança erro tipado", () => {
    expect(() => assertEvolutionTransportNotAvailable()).toThrow(
      EvolutionProviderNotReadyError
    );
  });

  it("throwEvolutionProviderNotReady usa AppError 503", () => {
    try {
      throwEvolutionProviderNotReady();
      fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(503);
    }
  });

  it("placeholder de sessão não chama transporte e normaliza OPENING", async () => {
    const whatsapp = {
      id: 3,
      companyId: 1,
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    };
    await startEvolutionWhatsAppSessionPlaceholder(whatsapp as never, 1);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "DISCONNECTED" });
  });
});
