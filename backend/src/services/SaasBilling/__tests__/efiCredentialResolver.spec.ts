import AppError from "../../../errors/AppError";
import { encryptEfiBinary, encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import {
  assertResolverIgnoresLegacyEnv,
  derivePlatformEfiConfigStatus,
  evaluateEfiConfigReadiness,
  getEfiResolverPublicSnapshot,
  resolveEfiCredentials
} from "../efiCredentialResolver";
import {
  EFI_B2_ACTIVATION_AUDIT,
  efiActivationAudit,
  efiTestP12
} from "./fixtures/efiTestP12";

jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));
jest.mock("../../../models/PlatformEfiConfigAudit", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

const findOne = PlatformEfiConfig.findOne as jest.Mock;
const auditFindOne = PlatformEfiConfigAudit.findOne as jest.Mock;

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
    // Ativação B3.1 válida para a linha devolvida por findOne (P-B31-03).
    auditFindOne.mockReset().mockImplementation(async (opts: any) => {
      if (opts?.where?.action !== "activate") return null;
      const current = await findOne.getMockImplementation()?.();
      return current ? efiActivationAudit(current) : null;
    });
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
      certificateEncrypted: encryptEfiBinary(efiTestP12()),
      certificateStorageKey: "efi-cert-homologation-aabb",
      certificateFingerprint: "deadbeef",
      activatedAt: new Date(),
      lastAuthTestOk: true,
      adminEnabled: true,
      pixHomologated: false,
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
    const resolved = await resolveEfiCredentials();
    expect(resolved.clientId).toBe("Client_Id_FROM_DB_abc");
    expect(resolved.clientSecret).toBe("Client_Secret_FROM_DB_xyz");
    expect(resolved.clientId).not.toBe(process.env.GERENCIANET_CLIENT_ID);
    expect(resolved.cobrancasClientId).toBe("Client_Id_FROM_DB_abc");
    expect(JSON.stringify(resolved)).not.toContain("LEGACY_");
    expect(resolved.slot).toBe("homologation");
    expect(resolved.runtime).toBe("test");
    expect(resolved.certificatePfx.equals(efiTestP12())).toBe(true);
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

  it("B3.1: não exige mais `operational` cegamente (D-P2 no slot homologation)", async () => {
    findOne.mockResolvedValue(buildRow({ status: "auth_validated" }));
    await expect(resolveEfiCredentials()).resolves.toMatchObject({
      status: "auth_validated"
    });
  });

  it("falha se certificado ausente quando exigido", async () => {
    findOne.mockResolvedValue(
      buildRow({
        certificateEncrypted: null,
        certificateStorageKey: null
      })
    );
    await expect(resolveEfiCredentials()).rejects.toMatchObject({
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

  it("P-B31-03: ativação da B2 sem validação Pix → ERR_EFI_PIX_VALIDATION_REQUIRED", async () => {
    findOne.mockResolvedValue(buildRow());
    auditFindOne.mockImplementation(async (opts: any) =>
      opts?.where?.action === "activate" ? EFI_B2_ACTIVATION_AUDIT : null
    );
    await expect(resolveEfiCredentials()).rejects.toMatchObject({
      message: "ERR_EFI_PIX_VALIDATION_REQUIRED",
      statusCode: 403
    });
    const row: any = buildRow();
    expect(evaluateEfiConfigReadiness(row, { pixValidated: false })).toEqual({
      validConfig: false,
      missing: ["pixValidation"]
    });
    expect(evaluateEfiConfigReadiness(row, { pixValidated: true }).validConfig).toBe(true);
  });

  it("T-CRED-16: status unificado — tabela com todas as combinações", () => {
    const enc = encryptEfiSecret("v");
    const bools = [false, true];
    const seen = new Set<string>();
    for (const status of ["empty", "configured", "operational", "revoked"] as const)
      for (const id of bools)
        for (const secret of bools)
          for (const cert of bools)
            for (const pix of bools)
              for (const wh of bools)
                for (const auth of [null, false, true])
                  for (const admin of bools)
                    for (const homolog of bools) {
                      const row: any = {
                        status,
                        clientIdEncrypted: id ? enc : null,
                        clientSecretEncrypted: secret ? enc : null,
                        certificateEncrypted: cert ? enc : null,
                        pixKeyEncrypted: pix ? enc : null,
                        webhookSecretConfigured: wh,
                        lastAuthTestOk: auth,
                        adminEnabled: admin,
                        pixHomologated: homolog
                      };
                      const got = derivePlatformEfiConfigStatus(row);
                      seen.add(got);
                      let expected: string;
                      if (status === "revoked" && !id) expected = "revoked";
                      else if (!(id && secret))
                        expected = id || secret || cert || pix || wh ? "incomplete" : "empty";
                      else if (homolog && admin) expected = "operational";
                      else if (auth === true) expected = "auth_validated";
                      else expected = "configured";
                      expect(got).toBe(expected);
                    }
    expect([...seen].sort()).toEqual(
      ["auth_validated", "configured", "empty", "incomplete", "operational", "revoked"]
    );
  });
});
