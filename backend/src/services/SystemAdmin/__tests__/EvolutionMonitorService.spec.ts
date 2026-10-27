import {
  extractWhatsappNumber,
  getEvolutionMonitorSnapshot,
  resetEvolutionMonitorCache
} from "../EvolutionMonitorService";
import { EvolutionHttpError } from "../../../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient";

const mockFetchAll = jest.fn();
const mockFindAll = jest.fn();

jest.mock("../../../models/WhatsappEvolutionCredential", () => ({
  __esModule: true,
  default: { findAll: (...args: any[]) => mockFindAll(...args) }
}));
jest.mock("../../../models/Company", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));
jest.mock(
  "../../../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient",
  () => {
    class MockEvolutionHttpError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    }
    return {
      EvolutionHttpError: MockEvolutionHttpError,
      evolutionCentralFetchAllInstances: (...args: any[]) =>
        mockFetchAll(...args)
    };
  }
);
jest.mock(
  "../../../modules/whatsapp/providers/evolution/lifecycle/ensureEvolutionInstance",
  () => ({
    listFromFetch: (data: unknown) => (Array.isArray(data) ? data : [])
  })
);

const SECRET_KEY = "super-secret-central-key";
const INSTANCE_TOKEN = "instance-token-abc";

const remoteInstances = [
  {
    id: "uuid-1",
    name: "streamhub-c1-w10",
    connectionStatus: "open",
    ownerJid: "5511987654321@s.whatsapp.net",
    profileName: "Loja A",
    token: INSTANCE_TOKEN,
    updatedAt: "2026-10-27T10:00:00.000Z"
  },
  {
    name: "streamhub-c2-w20",
    connectionStatus: "close",
    ownerJid: null,
    token: INSTANCE_TOKEN,
    updatedAt: null
  },
  {
    name: "streamhub-c2-w21",
    connectionStatus: "connecting",
    token: INSTANCE_TOKEN
  },
  {
    name: "manual-orphan",
    connectionStatus: "open",
    ownerJid: "5521999990000@s.whatsapp.net",
    token: INSTANCE_TOKEN
  }
];

const credentials = [
  {
    instanceName: "streamhub-c1-w10",
    companyId: 1,
    whatsappId: 10,
    company: { id: 1, name: "Empresa A" },
    whatsapp: {
      id: 10,
      name: "Comercial",
      updatedAt: new Date("2026-10-01T00:00:00Z")
    }
  },
  {
    instanceName: "STREAMHUB-C2-W20",
    companyId: 2,
    whatsappId: 20,
    company: { id: 2, name: "Empresa B" },
    whatsapp: {
      id: 20,
      name: "Suporte",
      updatedAt: new Date("2026-10-02T00:00:00Z")
    }
  },
  {
    instanceName: "streamhub-c2-w21",
    companyId: 2,
    whatsappId: 21,
    company: { id: 2, name: "Empresa B" },
    whatsapp: { id: 21, name: "Vendas", updatedAt: null }
  }
];

describe("EvolutionMonitorService", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetEvolutionMonitorCache();
    process.env = {
      ...OLD_ENV,
      EVOLUTION_CENTRAL_BASE_URL: "http://127.0.0.1:8081/",
      EVOLUTION_CENTRAL_API_KEY: SECRET_KEY
    };
    mockFetchAll.mockResolvedValue(remoteInstances);
    mockFindAll.mockResolvedValue(credentials);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("calcula indicadores e estados (conectada, desconectada, em conexão)", async () => {
    const snap = await getEvolutionMonitorSnapshot();
    expect(snap.api.status).toBe("online");
    expect(snap.indicators).toEqual({
      total: 4,
      connected: 2,
      disconnected: 1,
      connecting: 1,
      companies: 2,
      unlinked: 1
    });
    const byName = Object.fromEntries(
      snap.instances.map(i => [i.instanceName, i])
    );
    expect(byName["streamhub-c1-w10"].state).toBe("connected");
    expect(byName["streamhub-c2-w20"].state).toBe("disconnected");
    expect(byName["streamhub-c2-w21"].state).toBe("connecting");
  });

  it("associa instância à empresa pela credencial (case-insensitive)", async () => {
    const snap = await getEvolutionMonitorSnapshot();
    const byName = Object.fromEntries(
      snap.instances.map(i => [i.instanceName, i])
    );
    expect(byName["streamhub-c1-w10"]).toMatchObject({
      linked: true,
      companyId: 1,
      companyName: "Empresa A",
      whatsappId: 10,
      whatsappName: "Comercial",
      number: "5511987654321",
      lastUpdate: "2026-10-27T10:00:00.000Z"
    });
    expect(byName["streamhub-c2-w20"]).toMatchObject({
      linked: true,
      companyId: 2,
      number: null,
      // sem updatedAt da Evolution → Whatsapp.updatedAt
      lastUpdate: "2026-10-02T00:00:00.000Z"
    });
  });

  it("marca instância sem credencial como sem empresa", async () => {
    const snap = await getEvolutionMonitorSnapshot();
    const orphan = snap.instances.find(i => i.instanceName === "manual-orphan");
    expect(orphan).toMatchObject({
      linked: false,
      companyId: null,
      companyName: null,
      whatsappId: null
    });
    // sem empresa vai para o fim da lista
    expect(snap.instances[snap.instances.length - 1].instanceName).toBe(
      "manual-orphan"
    );
  });

  it("não expõe chaves, tokens nem baseUrl", async () => {
    const snap = await getEvolutionMonitorSnapshot();
    const json = JSON.stringify(snap);
    expect(json).not.toContain(SECRET_KEY);
    expect(json).not.toContain(INSTANCE_TOKEN);
    expect(json).not.toContain("127.0.0.1");
    expect(json).not.toMatch(/apikey|token|baseUrl|profileName|uuid-1/i);
    expect(mockFindAll.mock.calls[0][0].attributes).not.toContain(
      "apiKeyEncrypted"
    );
  });

  it("chama Evolution com config central e timeout curto", async () => {
    await getEvolutionMonitorSnapshot();
    expect(mockFetchAll).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:8081",
      apiKey: SECRET_KEY,
      timeoutMs: 10000
    });
  });

  it("API indisponível → estado offline controlado, sem lançar", async () => {
    mockFetchAll.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "Timeout")
    );
    const snap = await getEvolutionMonitorSnapshot();
    expect(snap.api.status).toBe("offline");
    expect(snap.api.errorCode).toBe("ERR_EVOLUTION_TIMEOUT");
    expect(snap.instances).toEqual([]);
    expect(snap.indicators.total).toBe(0);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it("erro inesperado também vira offline", async () => {
    mockFetchAll.mockRejectedValue(new Error("boom"));
    const snap = await getEvolutionMonitorSnapshot();
    expect(snap.api).toMatchObject({
      status: "offline",
      errorCode: "ERR_EVOLUTION_REQUEST_FAILED"
    });
  });

  it("sem config central → not_configured sem chamar Evolution", async () => {
    delete process.env.EVOLUTION_CENTRAL_BASE_URL;
    const snap = await getEvolutionMonitorSnapshot();
    expect(snap.api.status).toBe("not_configured");
    expect(mockFetchAll).not.toHaveBeenCalled();
  });

  describe("cache", () => {
    afterEach(() => jest.useRealTimers());

    it("reutiliza snapshot por 60s e renova depois", async () => {
      jest.useFakeTimers("modern");
      jest.setSystemTime(new Date("2026-10-27T12:00:00Z"));
      await getEvolutionMonitorSnapshot();
      jest.setSystemTime(new Date("2026-10-27T12:00:59Z"));
      await getEvolutionMonitorSnapshot();
      expect(mockFetchAll).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date("2026-10-27T12:01:01Z"));
      await getEvolutionMonitorSnapshot();
      expect(mockFetchAll).toHaveBeenCalledTimes(2);
    });

    it("deduplica chamadas concorrentes", async () => {
      await Promise.all([
        getEvolutionMonitorSnapshot(),
        getEvolutionMonitorSnapshot(),
        getEvolutionMonitorSnapshot()
      ]);
      expect(mockFetchAll).toHaveBeenCalledTimes(1);
    });

    it("também guarda erro em cache (não martela Evolution fora do ar)", async () => {
      mockFetchAll.mockRejectedValue(new Error("down"));
      await getEvolutionMonitorSnapshot();
      await getEvolutionMonitorSnapshot();
      expect(mockFetchAll).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["5511987654321@s.whatsapp.net", "5511987654321"],
    ["5511987654321:12@s.whatsapp.net", "5511987654321"],
    ["5511987654321", "5511987654321"],
    ["abc", null],
    [null, null]
  ])("extractWhatsappNumber(%p) → %p", (input, expected) => {
    expect(extractWhatsappNumber(input)).toBe(expected);
  });
});
