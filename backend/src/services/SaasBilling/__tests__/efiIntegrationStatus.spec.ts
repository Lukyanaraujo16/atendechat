import axios from "axios";
import fs from "fs";
import {
  __resetEfiAuthTestRateLimitForTests,
  assertEfiAuthTestRateLimit,
  getEfiIntegrationStatus,
  sanitizeEfiAuthErrorMessage,
  testEfiCobrancasAuthentication
} from "../efiIntegrationStatus";

import { encryptEfiBinary, encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import { computeEfiConfigFingerprint } from "../efiConfigFingerprint";
import {
  buildValidEfiConfigRow,
  EFI_B2_ACTIVATION_AUDIT,
  efiActivationAudit,
  mockEfiAuditsByAction
} from "./fixtures/efiTestP12";

jest.mock("axios");
jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/PlatformEfiConfigAudit", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;
const findOne = PlatformEfiConfig.findOne as jest.Mock;
const auditFindOne = PlatformEfiConfigAudit.findOne as jest.Mock;

describe("efiIntegrationStatus", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    __resetEfiAuthTestRateLimitForTests();
    jest.clearAllMocks();
    delete process.env.STREAMHUB_RUNTIME_ENV;
    findOne.mockResolvedValue(null);
    auditFindOne.mockResolvedValue(null);
  });

  afterAll(() => {
    process.env = { ...original };
  });

  it("não expõe secrets, tokens nem caminhos no status", async () => {
    process.env.GERENCIANET_SANDBOX = "true";
    process.env.GERENCIANET_CLIENT_ID = "Client_Id_SECRET_VALUE";
    process.env.GERENCIANET_CLIENT_SECRET = "Client_Secret_SECRET_VALUE";
    process.env.GERENCIANET_PIX_CERT = "meu-cert";
    process.env.GERENCIANET_PIX_KEY = "chave-pix-secreta";
    process.env.WEBHOOK_SUBSCRIPTION_SECRET = "whsec";

    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const status = await getEfiIntegrationStatus();
    const json = JSON.stringify(status);

    expect(json).not.toContain("Client_Id_SECRET_VALUE");
    expect(json).not.toContain("Client_Secret_SECRET_VALUE");
    expect(json).not.toContain("chave-pix-secreta");
    expect(json).not.toContain("whsec");
    expect(json).not.toContain(".p12");
    expect(json).not.toContain("/certs/");
    expect(status.credentials.clientIdConfigured).toBe(true);
    expect(status.credentials.clientSecretConfigured).toBe(true);
    expect(status.certificate.nameConfigured).toBe(true);
    expect(status.certificate.fileFound).toBe(false);
    expect(status.environment).toBe("sandbox");
    expect(status.authTests.pixIsolatedAuthAvailable).toBe(false);
  });

  it("marca credenciais e certificado ausentes", async () => {
    delete process.env.GERENCIANET_CLIENT_ID;
    delete process.env.GERENCIANET_CLIENT_SECRET;
    delete process.env.GERENCIANET_PIX_CERT;
    delete process.env.EFI_COBRANCAS_CLIENT_ID;
    delete process.env.EFI_COBRANCAS_CLIENT_SECRET;
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const status = await getEfiIntegrationStatus();
    expect(status.credentials.clientIdConfigured).toBe(false);
    expect(status.credentials.clientSecretConfigured).toBe(false);
    expect(status.certificate.fileFound).toBe(false);
    expect(status.readiness.pix.ready).toBe(false);
    expect(status.readiness.cobrancas.ready).toBe(false);
    expect(status.readiness.pix.missing.length).toBeGreaterThan(0);
  });

  it("sanitiza erros de autenticação", () => {
    const msg = sanitizeEfiAuthErrorMessage({
      message: "invalid_client Bearer abc.def.ghi client_secret=supersecret"
    });
    expect(msg).not.toContain("supersecret");
    expect(msg).not.toContain("abc.def.ghi");
    expect(msg).toMatch(/Bearer \*\*\*/);
  });

  it("sanitiza timeout", () => {
    const msg = sanitizeEfiAuthErrorMessage({
      code: "ECONNABORTED",
      message: "timeout of 15000ms exceeded"
    });
    expect(msg).toMatch(/Timeout/i);
  });

  it("teste OAuth falha sem credenciais sem chamar a API", async () => {
    delete process.env.GERENCIANET_CLIENT_ID;
    delete process.env.GERENCIANET_CLIENT_SECRET;
    delete process.env.EFI_COBRANCAS_CLIENT_ID;
    delete process.env.EFI_COBRANCAS_CLIENT_SECRET;

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ausentes/i);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("teste OAuth sucesso não retorna access_token", async () => {
    process.env.GERENCIANET_CLIENT_ID = "id";
    process.env.GERENCIANET_CLIENT_SECRET = "secret";
    process.env.GERENCIANET_SANDBOX = "true";

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { access_token: "SHOULD_NOT_LEAK", expires_in: 600, token_type: "Bearer" }
    } as any);

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SHOULD_NOT_LEAK");
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const url = mockedAxios.post.mock.calls[0][0] as string;
    expect(url).toContain("/v1/authorize");
    expect(url).not.toContain("one-step");
    expect(url).not.toContain("/charge");
  });

  it("teste OAuth erro sanitizado", async () => {
    process.env.GERENCIANET_CLIENT_ID = "id";
    process.env.GERENCIANET_CLIENT_SECRET = "secret";

    mockedAxios.post.mockResolvedValue({
      status: 401,
      data: {
        error: "invalid_client",
        error_description: "client_secret=leaked-secret Bearer tok.xyz"
      }
    } as any);

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("leaked-secret");
    expect(result.message).not.toContain("tok.xyz");
  });

  it("rate limit bloqueia após excesso", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(assertEfiAuthTestRateLimit(42).allowed).toBe(true);
    }
    const blocked = assertEfiAuthTestRateLimit(42);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
  describe("B3.1 — fonte, prontidão, fingerprint e homologação", () => {
    const row = (o: Record<string, unknown> = {}) =>
      buildValidEfiConfigRow(encryptEfiSecret, encryptEfiBinary, o);

    beforeEach(() => {
      process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "b31-status-test-key-32chars!!!";
      delete process.env.EFI_CREDENTIALS_SOURCE;
      delete process.env.GIT_COMMIT;
    });

    it("T-ACT-02: controles efetivos no status (defaults)", async () => {
      const status = await getEfiIntegrationStatus();
      expect(status.controls).toMatchObject({
        credentialsSource: "legacy_env",
        pixChargeV2Enabled: false,
        webhookPipeline: "legacy",
        webhookWorkerPaused: false,
        pixReconciliationSweepEnabled: false,
        trustProxyHops: null
      });
      expect(status.credentialsSource.active).toBe("legacy_env");
      expect(status.credentialsSource.database.blockedReason).toBe(
        "ERR_STREAMHUB_RUNTIME_ENV_INVALID"
      );
    });

    /** Linha do slot com ativação B3.1 válida (P-B31-03) e, opcionalmente, homologação. */
    const setRow = (r: Record<string, any>, homologate: unknown = null) => {
      findOne.mockResolvedValue(r);
      mockEfiAuditsByAction(auditFindOne, { activate: efiActivationAudit(r), homologate });
    };

    it("B3.2: status mostra a cobrança v2 configurada × liberada × ativa", async () => {
      process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
      const status = await getEfiIntegrationStatus();
      expect(status.pixChargeV2).toEqual({ configured: true, released: false, releasedRuntimes: [], active: false });
    });

    it("T-ENV-06: TESTE com configuração válida → usable, fingerprint, sem segredos", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      const r = row();
      setRow(r);
      const status = await getEfiIntegrationStatus();
      expect(status.credentialsSource).toMatchObject({
        active: "database",
        // P-B31-08: o financeiro segue no env mesmo com database configurado.
        financial: "legacy_env",
        databaseFinancialReleased: false,
        database: {
          runtime: "test",
          slot: "homologation",
          efiEnvironment: "sandbox",
          configFound: true,
          validConfig: true,
          missing: [],
          configFingerprint: computeEfiConfigFingerprint(r as any),
          pixValidation: { validated: true, at: "2026-10-20T10:00:00.000Z" },
          homologation: { required: false, homologated: false },
          usable: true,
          blockedReason: null
        }
      });
      const json = JSON.stringify(status);
      expect(json).not.toContain("efic1:");
      expect(json).not.toContain("Client_Secret_FROM_DB");
      expect(json).not.toContain("pix-key-db");
    });

    it("T-ENV-06/T-HOM-02: PRODUÇÃO sem homologação → bloqueada; itens ausentes listados", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      setRow(row({ slot: "production", efiEnvironment: "production" }));
      let status = await getEfiIntegrationStatus();
      expect(status.credentialsSource.database).toMatchObject({
        validConfig: true,
        homologation: { required: true, homologated: false },
        usable: false,
        blockedReason: "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED"
      });

      findOne.mockResolvedValue(
        row({ slot: "production", efiEnvironment: "production", adminEnabled: false, pixKeyEncrypted: null })
      );
      status = await getEfiIntegrationStatus();
      // A ativação registrada era de outro fingerprint (chave Pix removida depois).
      expect(status.credentialsSource.database.missing).toEqual([
        "adminEnabled",
        "pixValidation",
        "pixKey"
      ]);
    });

    it("P-B31-03: ativação da B2 → validação Pix ausente, fonte inutilizável", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      findOne.mockResolvedValue(row());
      mockEfiAuditsByAction(auditFindOne, { activate: EFI_B2_ACTIVATION_AUDIT });
      const status = await getEfiIntegrationStatus();
      expect(status.credentialsSource.database).toMatchObject({
        validConfig: false,
        missing: ["pixValidation"],
        pixValidation: { validated: false, at: null },
        usable: false,
        blockedReason: "missing:pixValidation"
      });
    });

    it("erro de banco não derruba o status (fonte legacy_env segue visível)", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      findOne.mockRejectedValue(new Error("relation does not exist"));
      const status = await getEfiIntegrationStatus();
      expect(status.credentialsSource.active).toBe("legacy_env");
      expect(status.credentialsSource.database.blockedReason).toBe(
        "ERR_EFI_STATUS_DB_UNAVAILABLE"
      );
      expect(status.readiness).toBeDefined();
    });

    it("PT-9: versão atual difere da homologada", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      process.env.GIT_COMMIT = "bbbbbbb";
      const r = row({ slot: "production", efiEnvironment: "production" });
      setRow(r, {
        id: 5,
        createdAt: new Date("2026-10-21T00:00:00Z"),
        diffSummary: JSON.stringify({
          configFingerprint: computeEfiConfigFingerprint(r as any),
          efiEnvironment: "production",
          commit: "aaaaaaa"
        })
      });
      const status = await getEfiIntegrationStatus();
      // Sem dist/build-info.json no ts-jest: cai no fallback de env.
      expect(status.version).toMatchObject({ currentCommit: "bbbbbbb", source: "env" });
      expect(status.credentialsSource.database).toMatchObject({
        usable: true,
        homologation: { homologated: true, commit: "aaaaaaa", versionDiffers: true }
      });
    });
  });
});
