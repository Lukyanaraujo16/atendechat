jest.mock("../../../../../../models/WhatsappEvolutionCredential", () => ({
  __esModule: true,
  default: {
    unscoped: jest.fn(() => ({
      findOne: jest.fn(),
      create: jest.fn()
    }))
  }
}));

import WhatsappEvolutionCredential from "../../../../../../models/WhatsappEvolutionCredential";
import { provisionCentralEvolutionCredentials } from "../provisionCentralEvolutionCredentials";
import { decryptEvolutionApiKey } from "../../../../../../helpers/evolutionCredentialCrypto";

describe("provisionCentralEvolutionCredentials", () => {
  const prevBase = process.env.EVOLUTION_CENTRAL_BASE_URL;
  const prevKey = process.env.EVOLUTION_CENTRAL_API_KEY;
  const prevEnc = process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.EVOLUTION_CENTRAL_BASE_URL = "https://central.evo.example/";
    process.env.EVOLUTION_CENTRAL_API_KEY = "central-global-api-key";
    process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY =
      "fase10-5-test-evolution-secret";
  });

  afterAll(() => {
    if (prevBase === undefined) delete process.env.EVOLUTION_CENTRAL_BASE_URL;
    else process.env.EVOLUTION_CENTRAL_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.EVOLUTION_CENTRAL_API_KEY;
    else process.env.EVOLUTION_CENTRAL_API_KEY = prevKey;
    if (prevEnc === undefined) {
      delete process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY = prevEnc;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persiste baseUrl, instanceName e apiKey cifrada por conexão", async () => {
    const create = jest.fn().mockImplementation(async row => ({
      ...row,
      id: 1
    }));
    (WhatsappEvolutionCredential.unscoped as jest.Mock).mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
      create
    });

    const result = await provisionCentralEvolutionCredentials({
      companyId: 3,
      whatsappId: 88
    });

    expect(result.instanceName).toBe("streamhub-c3-w88");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 3,
        whatsappId: 88,
        baseUrl: "https://central.evo.example",
        instanceName: "streamhub-c3-w88"
      })
    );
    const cipher = create.mock.calls[0][0].apiKeyEncrypted;
    expect(cipher).toMatch(/^evo1:/);
    expect(decryptEvolutionApiKey(cipher)).toBe("central-global-api-key");
    expect(JSON.stringify(result)).not.toContain("central-global-api-key");
  });

  it("multi-tenant: credenciais distintas por whatsappId", async () => {
    const rows: Record<number, { instanceName: string }> = {};
    const create = jest.fn().mockImplementation(async row => {
      const saved = { ...row, id: row.whatsappId };
      rows[row.whatsappId] = saved;
      return saved;
    });
    (WhatsappEvolutionCredential.unscoped as jest.Mock).mockReturnValue({
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        const id = where.whatsappId;
        return rows[id] ?? null;
      }),
      create
    });

    await provisionCentralEvolutionCredentials({ companyId: 1, whatsappId: 10 });
    await provisionCentralEvolutionCredentials({ companyId: 2, whatsappId: 20 });

    expect(rows[10].instanceName).toBe("streamhub-c1-w10");
    expect(rows[20].instanceName).toBe("streamhub-c2-w20");
    expect(rows[10].instanceName).not.toBe(rows[20].instanceName);
  });
});
