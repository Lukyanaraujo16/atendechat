import AppError from "../../../errors/AppError";
import { encryptEfiBinary, encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import {
  assertResolverIgnoresLegacyEnv,
  derivePlatformEfiConfigStatus,
  getEfiResolverPublicSnapshot,
  resolveEfiCredentials
} from "../efiCredentialResolver";

jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

const findOne = PlatformEfiConfig.findOne as jest.Mock;

describe("efiCredentialResolver", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "resolver-test-key-32chars!!!!";
    // Legado propositalmente preenchido — resolvedor NÃO deve usar
    process.env.GERENCIANET_CLIENT_ID = "LEGACY_CLIENT_ID_SHOULD_NOT_APPEAR";
    process.env.GERENCIANET_CLIENT_SECRET = "LEGACY_SECRET_SHOULD_NOT_APPEAR";
    process.env.EFI_COBRANCAS_CLIENT_ID = "LEGACY_COBRANCAS_ID";
    process.env.EFI_COBRANCAS_CLIENT_SECRET = "LEGACY_COBRANCAS_SECRET";
    findOne.mockReset();
  });

  afterAll(() => {
    process.env = original;
  });

  function buildRow(overrides: Record<string, unknown> = {}) {
    const clientId = "Client_Id_FROM_DB_abc";
    const clientSecret = "Client_Secret_FROM_DB_xyz";
    return {
      id: 1,
      slot: "homologation",
      efiEnvironment: "sandbox",
      status: "operational",
      clientIdEncrypted: encryptEfiSecret(clientId),
      clientSecretEncrypted: encryptEfiSecret(clientSecret),
      clientIdMasked: "****_abc",
      pixKeyEncrypted: encryptEfiSecret("pix-key-db"),
      pixKeyMasked: "****-key-db",
      webhookSecretEncrypted: encryptEfiSecret("whsec-db"),
      webhookSecretConfigured: true,
      cobrancasClientIdEncrypted: null,
      cobrancasClientSecretEncrypted: null,
      certificateEncrypted: encryptEfiBinary(
        Buffer.from([0x30, 0x82, 0x00, 0x01, 0x02])
      ),
      certificateStorageKey: "efi-cert-homologation-aabb",
      certificateFingerprint: "deadbeef",
      activatedAt: new Date(),
      lastAuthTestOk: true,
      ...overrides
    };
  }

  it("declara ausência de fallback legado", () => {
    expect(assertResolverIgnoresLegacyEnv()).toEqual({
      readsGerencianet: false,
      readsEfiCobrancas: false,
      source: "database_only"
    });
  });

  it("resolve do banco e ignora GERENCIANET_*/EFI_COBRANCAS_*", async () => {
    findOne.mockResolvedValue(buildRow());
    const resolved = await resolveEfiCredentials({ requireCertificate: false });
    expect(resolved.clientId).toBe("Client_Id_FROM_DB_abc");
    expect(resolved.clientSecret).toBe("Client_Secret_FROM_DB_xyz");
    expect(resolved.clientId).not.toBe(process.env.GERENCIANET_CLIENT_ID);
    expect(resolved.cobrancasClientId).toBe("Client_Id_FROM_DB_abc");
    expect(JSON.stringify(resolved)).not.toContain("LEGACY_");
    expect(resolved.slot).toBe("homologation");
    expect(resolved.runtime).toBe("test");
  });

  it("falha com runtime inválido", async () => {
    delete process.env.STREAMHUB_RUNTIME_ENV;
    findOne.mockResolvedValue(buildRow());
    await expect(resolveEfiCredentials()).rejects.toMatchObject({
      message: "ERR_STREAMHUB_RUNTIME_ENV_INVALID"
    });
  });

  it("runtime test bloqueia config production no banco", async () => {
    findOne.mockResolvedValue(
      buildRow({ slot: "production", efiEnvironment: "production" })
    );
    // findOne still returns production row if DB wrong — assert on row fields
    await expect(resolveEfiCredentials()).rejects.toBeInstanceOf(AppError);
  });

  it("falha se configuração inexistente", async () => {
    findOne.mockResolvedValue(null);
    await expect(resolveEfiCredentials()).rejects.toMatchObject({
      message: "ERR_EFI_CONFIG_NOT_FOUND"
    });
  });

  it("falha se não operacional", async () => {
    findOne.mockResolvedValue(buildRow({ status: "configured" }));
    await expect(resolveEfiCredentials()).rejects.toMatchObject({
      message: "ERR_EFI_CONFIG_NOT_OPERATIONAL"
    });
  });

  it("falha se certificado ausente quando exigido", async () => {
    findOne.mockResolvedValue(
      buildRow({
        certificateEncrypted: null,
        certificateStorageKey: null
      })
    );
    await expect(
      resolveEfiCredentials({ requireCertificate: true })
    ).rejects.toMatchObject({
      message: "ERR_EFI_CERTIFICATE_MISSING"
    });
  });

  it("snapshot público não expõe secrets nem ciphertext", async () => {
    const row = buildRow();
    findOne.mockResolvedValue(row);
    const snap = await getEfiResolverPublicSnapshot();
    const json = JSON.stringify(snap);
    expect(json).not.toContain("Client_Id_FROM_DB");
    expect(json).not.toContain("efic1:");
    expect(json).not.toContain("LEGACY_");
    expect(snap.usesLegacyEnvFallback).toBe(false);
    expect(snap.certificatePresent).toBe(true);
    expect(snap.clientIdMasked).toBe("****_abc");
  });

  it("derivePlatformEfiConfigStatus cobre empty/incomplete/configured", () => {
    expect(
      derivePlatformEfiConfigStatus({
        clientIdEncrypted: null,
        clientSecretEncrypted: null,
        certificateEncrypted: null,
        webhookSecretConfigured: false,
        lastAuthTestOk: null,
        activatedAt: null,
        status: "empty"
      })
    ).toBe("empty");

    expect(
      derivePlatformEfiConfigStatus({
        clientIdEncrypted: encryptEfiSecret("a"),
        clientSecretEncrypted: null,
        certificateEncrypted: null,
        webhookSecretConfigured: false,
        lastAuthTestOk: null,
        activatedAt: null,
        status: "incomplete"
      })
    ).toBe("incomplete");

    expect(
      derivePlatformEfiConfigStatus({
        clientIdEncrypted: encryptEfiSecret("a"),
        clientSecretEncrypted: encryptEfiSecret("b"),
        certificateEncrypted: null,
        webhookSecretConfigured: false,
        lastAuthTestOk: null,
        activatedAt: null,
        status: "configured"
      })
    ).toBe("configured");
  });
});
