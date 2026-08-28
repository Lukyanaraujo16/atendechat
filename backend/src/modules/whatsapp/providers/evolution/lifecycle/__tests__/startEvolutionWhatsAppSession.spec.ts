/* eslint-disable import/first */
const ensureInstance = jest.fn();
const connectionState = jest.fn();
const connect = jest.fn();
const applyStatus = jest.fn();

jest.mock("../ensureEvolutionInstance", () => ({
  ensureEvolutionInstance: (...a: unknown[]) => ensureInstance(...a)
}));
jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class EvolutionHttpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  evolutionConnectionState: (...a: unknown[]) => connectionState(...a),
  evolutionConnect: (...a: unknown[]) => connect(...a)
}));
jest.mock("../applyEvolutionSessionStatus", () => ({
  applyEvolutionSessionStatus: (...a: unknown[]) => applyStatus(...a)
}));
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

import { startEvolutionWhatsAppSession } from "../startEvolutionWhatsAppSession";

function whatsapp(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    companyId: 1,
    status: "DISCONNECTED",
    qrcode: "",
    ...overrides
  };
}

describe("startEvolutionWhatsAppSession Fase 10", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureInstance.mockResolvedValue({
      created: false,
      reused: true,
      instanceName: "inst",
      instanceId: "1"
    });
    applyStatus.mockResolvedValue({ applied: true, status: "OPENING", qrcode: "" });
  });

  it("já connected → CONNECTED sem QR novo", async () => {
    connectionState.mockResolvedValue({
      instance: { state: "open" }
    });
    await startEvolutionWhatsAppSession(whatsapp() as never, 1);
    expect(ensureInstance).toHaveBeenCalledWith(7);
    expect(connect).not.toHaveBeenCalled();
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CONNECTED", qrcode: "" })
    );
  });

  it("disconnected → connect retorna QR", async () => {
    connectionState.mockResolvedValue({
      instance: { state: "close" }
    });
    connect.mockResolvedValue({ code: "2@QRRAW", count: 1 });
    await startEvolutionWhatsAppSession(whatsapp() as never, 1);
    expect(connect).toHaveBeenCalled();
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "qrcode", qrcode: "2@QRRAW" })
    );
  });

  it("instance ausente: ensure create + QR", async () => {
    ensureInstance.mockResolvedValue({
      created: true,
      reused: false,
      instanceName: "inst",
      instanceId: null
    });
    connectionState.mockResolvedValue({ instance: { state: "close" } });
    connect.mockResolvedValue({
      qrcode: { code: "2@NEW" }
    });
    await startEvolutionWhatsAppSession(whatsapp() as never, 1);
    expect(ensureInstance).toHaveBeenCalled();
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "qrcode", qrcode: "2@NEW" })
    );
  });

  it("falha API → DISCONNECTED sem throw (isolamento boot)", async () => {
    const { EvolutionHttpError } = jest.requireMock(
      "../../inbound/evolutionHttpClient"
    );
    ensureInstance.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "boom")
    );
    await startEvolutionWhatsAppSession(whatsapp() as never, 1);
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DISCONNECTED" })
    );
  });

  it("company mismatch → 403", async () => {
    await expect(
      startEvolutionWhatsAppSession(whatsapp({ companyId: 9 }) as never, 1)
    ).rejects.toMatchObject({ message: "ERR_FORBIDDEN" });
  });
});
