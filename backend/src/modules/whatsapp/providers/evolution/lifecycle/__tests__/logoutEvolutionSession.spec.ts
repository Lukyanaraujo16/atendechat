/* eslint-disable import/first */
const logoutApi = jest.fn();
const applyStatus = jest.fn();

jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class EvolutionHttpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  evolutionLogoutInstance: (...a: unknown[]) => logoutApi(...a),
  evolutionRestartInstance: jest.fn(),
  evolutionDeleteInstance: jest.fn()
}));
jest.mock("../applyEvolutionSessionStatus", () => ({
  applyEvolutionSessionStatus: (...a: unknown[]) => applyStatus(...a)
}));

import { logoutEvolutionWhatsAppSession } from "../logoutEvolutionSession";
import { deleteEvolutionRemoteInstanceBestEffort } from "../deleteEvolutionRemoteInstance";
import {
  EvolutionHttpError,
  evolutionDeleteInstance
} from "../../inbound/evolutionHttpClient";

describe("Evolution logout/delete Fase 10", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    applyStatus.mockResolvedValue({ applied: true });
  });

  it("logout chama endpoint e marca DISCONNECTED", async () => {
    logoutApi.mockResolvedValue({ status: "SUCCESS" });
    const wa = { id: 3, companyId: 1 };
    await logoutEvolutionWhatsAppSession(wa as never, 1);
    expect(logoutApi).toHaveBeenCalledWith({ whatsappId: 3 });
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DISCONNECTED", qrcode: "" })
    );
  });

  it("logout already close é benigno", async () => {
    logoutApi.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "not connected")
    );
    await logoutEvolutionWhatsAppSession(
      { id: 3, companyId: 1 } as never,
      1
    );
    expect(applyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DISCONNECTED" })
    );
  });

  it("logout timeout propaga erro tipado", async () => {
    logoutApi.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "timeout")
    );
    await expect(
      logoutEvolutionWhatsAppSession({ id: 3, companyId: 1 } as never, 1)
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_TIMEOUT" });
  });

  it("delete remoto best-effort: erro não lança", async () => {
    (evolutionDeleteInstance as jest.Mock).mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "fail")
    );
    const result = await deleteEvolutionRemoteInstanceBestEffort(9);
    expect(result.ok).toBe(false);
    expect(result.attempted).toBe(true);
  });
});
