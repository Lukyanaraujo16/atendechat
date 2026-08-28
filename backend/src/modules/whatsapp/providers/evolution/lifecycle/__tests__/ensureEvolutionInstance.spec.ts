/* eslint-disable import/first */
const fetchInstances = jest.fn();
const createInstance = jest.fn();
const setWebhook = jest.fn();
const loadCred = jest.fn();

jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class EvolutionHttpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  evolutionFetchInstances: (...a: unknown[]) => fetchInstances(...a),
  evolutionCreateInstance: (...a: unknown[]) => createInstance(...a),
  evolutionSetWebhook: (...a: unknown[]) => setWebhook(...a),
  loadEvolutionCredential: (...a: unknown[]) => loadCred(...a)
}));

jest.mock("../../../../../../models/WhatsappEvolutionCredential", () => ({
  __esModule: true,
  default: {
    unscoped: () => ({
      update: jest.fn().mockResolvedValue([1])
    })
  }
}));

import {
  assertSafeEvolutionInstanceName,
  clearEnsureEvolutionInstanceLocks,
  ensureEvolutionInstance
} from "../ensureEvolutionInstance";
import { EvolutionHttpError } from "../../inbound/evolutionHttpClient";

describe("ensureEvolutionInstance Fase 10", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearEnsureEvolutionInstanceLocks();
    process.env.BACKEND_URL = "https://app.example.com";
    loadCred.mockResolvedValue({
      baseUrl: "https://evo.example.com",
      instanceName: "inst-a",
      apiKey: "secret"
    });
  });

  it("instance inexistente → create", async () => {
    fetchInstances.mockResolvedValue([]);
    createInstance.mockResolvedValue({
      instance: { instanceName: "inst-a", instanceId: "uuid-1" }
    });
    const result = await ensureEvolutionInstance(10);
    expect(result.created).toBe(true);
    expect(createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappId: 10,
        instanceName: "inst-a",
        webhookUrl: "https://app.example.com/webhooks/evolution/10"
      })
    );
  });

  it("instance existente → reuse sem create", async () => {
    fetchInstances.mockResolvedValue([
      { instanceName: "inst-a", instanceId: "uuid-9" }
    ]);
    setWebhook.mockResolvedValue({});
    const result = await ensureEvolutionInstance(10);
    expect(result.reused).toBe(true);
    expect(createInstance).not.toHaveBeenCalled();
    expect(setWebhook).toHaveBeenCalled();
  });

  it("chamadas concorrentes → uma create lógica", async () => {
    fetchInstances.mockResolvedValue([]);
    let releaseCreate: (v: unknown) => void = () => undefined;
    createInstance.mockImplementation(
      () =>
        new Promise(resolve => {
          releaseCreate = resolve;
        })
    );

    const p1 = ensureEvolutionInstance(42);
    const p2 = ensureEvolutionInstance(42);
    await new Promise<void>(r => setImmediate(() => r()));
    expect(createInstance).toHaveBeenCalledTimes(1);
    releaseCreate({
      instance: { instanceName: "inst-a", instanceId: "x" }
    });
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.instanceName).toBe("inst-a");
    expect(b.instanceName).toBe("inst-a");
    expect(createInstance).toHaveBeenCalledTimes(1);
  });

  it("credential missing propaga", async () => {
    loadCred.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_CREDENTIAL_MISSING", "missing")
    );
    await expect(ensureEvolutionInstance(1)).rejects.toMatchObject({
      code: "ERR_EVOLUTION_CREDENTIAL_MISSING"
    });
  });

  it("create API error propaga", async () => {
    fetchInstances.mockResolvedValue([]);
    createInstance.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "fail")
    );
    await expect(ensureEvolutionInstance(10)).rejects.toMatchObject({
      code: "ERR_EVOLUTION_API_ERROR"
    });
  });

  it("already exists → reuse via refetch", async () => {
    fetchInstances
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ instanceName: "inst-a", instanceId: "z" }]);
    createInstance.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "already exists")
    );
    const result = await ensureEvolutionInstance(10);
    expect(result.reused).toBe(true);
  });

  it("instanceName inseguro rejeita", () => {
    expect(() => assertSafeEvolutionInstanceName("../etc")).toThrow();
    expect(() => assertSafeEvolutionInstanceName("ok_name-1")).not.toThrow();
  });
});
