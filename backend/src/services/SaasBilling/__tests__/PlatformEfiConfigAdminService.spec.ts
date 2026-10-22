import axios from "axios";
import AppError from "../../../errors/AppError";
import { encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import sequelize from "../../../database";
import {
  activateEfiAdminConfig,
  changeEfiApiEnvironment,
  deactivateEfiAdminConfig,
  deleteEfiCertificate,
  getEfiAdminConfigSafe,
  revokeEfiAdminConfig,
  testEfiAdminAuth,
  uploadEfiCertificate,
  upsertEfiAdminConfig
} from "../PlatformEfiConfigAdminService";
import { __resetEfiAuthTestRateLimitForTests } from "../efiIntegrationStatus";
import { derivePlatformEfiConfigStatus } from "../efiCredentialResolver";
import { computeEfiConfigFingerprint } from "../efiConfigFingerprint";
import { invalidateEfiRuntimeCredentialsCache } from "../efiRuntimeCredentials";
import { encryptEfiBinary } from "../../../helpers/efiCredentialCrypto";
import { efiTestP12 } from "./fixtures/efiTestP12";

jest.mock("../efiRuntimeCredentials", () => ({
  invalidateEfiRuntimeCredentialsCache: jest.fn()
}));
const invalidateCache = invalidateEfiRuntimeCredentialsCache as jest.Mock;

jest.mock("axios");
jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn()
  }
}));

jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/PlatformEfiConfigAudit", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findAll: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const findOne = PlatformEfiConfig.findOne as jest.Mock;
const findByPk = PlatformEfiConfig.findByPk as jest.Mock;
const create = PlatformEfiConfig.create as jest.Mock;
const auditCreate = PlatformEfiConfigAudit.create as jest.Mock;
const transaction = sequelize.transaction as jest.Mock;

const fakeP12 = efiTestP12;

describe("PlatformEfiConfigAdminService", () => {
  const original = { ...process.env };
  let row: any;
  let tx: any;

  beforeEach(() => {
    process.env = { ...original };
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "b2-admin-test-key-32chars!!!!";
    process.env.GERENCIANET_CLIENT_ID = "LEGACY_SHOULD_NOT_USE";
    process.env.GERENCIANET_CLIENT_SECRET = "LEGACY_SECRET";
    __resetEfiAuthTestRateLimitForTests();
    jest.clearAllMocks();
    auditCreate.mockResolvedValue({});

    tx = {
      LOCK: { UPDATE: "UPDATE" },
      commit: jest.fn(),
      rollback: jest.fn()
    };
    transaction.mockResolvedValue(tx);

    row = {
      id: 10,
      slot: "homologation",
      efiEnvironment: "sandbox",
      status: "empty",
      clientIdEncrypted: null,
      clientSecretEncrypted: null,
      clientIdMasked: null,
      pixKeyEncrypted: null,
      pixKeyMasked: null,
      webhookSecretEncrypted: null,
      webhookSecretConfigured: false,
      cobrancasClientIdEncrypted: null,
      cobrancasClientSecretEncrypted: null,
      cobrancasClientIdMasked: null,
      certificateEncrypted: null,
      certificateStorageKey: null,
      certificateFingerprint: null,
      certificateUploadedAt: null,
      lastAuthTestAt: null,
      lastAuthTestOk: null,
      lastAuthTestMessage: null,
      adminEnabled: false,
      pixHomologated: false,
      activatedAt: null,
      activatedByUserId: null,
      updatedByUserId: null,
      updatedAt: new Date(),
      save: jest.fn().mockImplementation(async function save(this: any) {
        return this;
      })
    };

    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    create.mockResolvedValue(row);
  });

  afterAll(() => {
    process.env = original;
  });

  it("GET não expõe plaintext nem ciphertext", async () => {
    row.clientIdEncrypted = encryptEfiSecret("Client_Id_SECRET");
    row.clientSecretEncrypted = encryptEfiSecret("Client_Secret_SECRET");
    row.clientIdMasked = "****CRET";
    const dto = await getEfiAdminConfigSafe();
    const json = JSON.stringify(dto);
    expect(json).not.toContain("Client_Id_SECRET");
    expect(json).not.toContain("Client_Secret_SECRET");
    expect(json).not.toContain("efic1:");
    expect(json).not.toContain("LEGACY_");
    expect(dto.credentials.clientIdConfigured).toBe(true);
    expect(dto.checkoutUsesLegacyEnv).toBe(true);
    expect(dto.pixOperational).toBe(false);
  });

  it("runtime inválido não assume ambiente", async () => {
    delete process.env.STREAMHUB_RUNTIME_ENV;
    const dto = await getEfiAdminConfigSafe();
    expect(dto.diagnosticState).toBe("runtime_invalid");
    expect(dto.runtime.valid).toBe(false);
  });

  it("runtime test bloqueia slot production", async () => {
    await expect(
      upsertEfiAdminConfig({
        slot: "production",
        actorUserId: 1,
        body: { clientId: "x" }
      })
    ).rejects.toMatchObject({ message: "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME" });
  });

  it("secret vazio não apaga secret existente", async () => {
    row.clientIdEncrypted = encryptEfiSecret("keep-id");
    row.clientSecretEncrypted = encryptEfiSecret("keep-secret");
    row.clientIdMasked = "****-id";
    row.status = "configured";

    await upsertEfiAdminConfig({
      slot: "homologation",
      actorUserId: 1,
      body: { clientSecret: "", clientId: "" }
    });

    expect(decryptStillPresent()).toBe(true);
    expect(row.clientSecretEncrypted).toContain("efic1:");
  });

  function decryptStillPresent() {
    return (
      typeof row.clientIdEncrypted === "string" &&
      row.clientIdEncrypted.startsWith("efic1:") &&
      typeof row.clientSecretEncrypted === "string" &&
      row.clientSecretEncrypted.startsWith("efic1:")
    );
  }

  it("rotação grava novo ciphertext e invalida auth/admin", async () => {
    row.clientIdEncrypted = encryptEfiSecret("old-id");
    row.clientSecretEncrypted = encryptEfiSecret("old-secret");
    row.lastAuthTestOk = true;
    row.adminEnabled = true;

    await upsertEfiAdminConfig({
      slot: "homologation",
      actorUserId: 1,
      body: { clientSecret: "new-secret-value" }
    });

    expect(row.clientSecretEncrypted).toContain("efic1:");
    expect(row.lastAuthTestOk).toBeNull();
    expect(row.adminEnabled).toBe(false);
    expect(tx.commit).toHaveBeenCalled();
  });

  it("falha sem chave de criptografia", async () => {
    delete process.env.EFI_CREDENTIAL_ENCRYPTION_KEY;
    await expect(
      upsertEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        body: { clientId: "abc" }
      })
    ).rejects.toMatchObject({
      message: "ERR_EFI_CREDENTIAL_ENCRYPTION_KEY_MISSING"
    });
  });

  it("P12 inválido é rejeitado; válido persiste blob", async () => {
    await expect(
      uploadEfiCertificate({
        slot: "homologation",
        actorUserId: 1,
        buffer: Buffer.from("not-a-cert"),
        originalName: "x.p12"
      })
    ).rejects.toBeInstanceOf(AppError);

    await uploadEfiCertificate({
      slot: "homologation",
      actorUserId: 1,
      buffer: fakeP12(),
      originalName: "efi.p12"
    });
    expect(row.certificateEncrypted).toContain("efic1:");
    expect(row.certificateFingerprint).toHaveLength(64);
    expect(row.adminEnabled).toBe(false);
  });

  it("P12 acima do limite", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 10, 0x30);
    await expect(
      uploadEfiCertificate({
        slot: "homologation",
        actorUserId: 1,
        buffer: big,
        originalName: "big.p12"
      })
    ).rejects.toMatchObject({ message: "ERR_EFI_CERTIFICATE_TOO_LARGE" });
  });

  it("test-auth usa banco, não legado; Pix não validado; OAuth não cria cobrança", async () => {
    row.clientIdEncrypted = encryptEfiSecret("db-client-id");
    row.clientSecretEncrypted = encryptEfiSecret("db-client-secret");
    row.status = "configured";

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { access_token: "tok", expires_in: 600 }
    });

    const result = await testEfiAdminAuth({
      slot: "homologation",
      actorUserId: 1
    });

    expect(mockedAxios.post).toHaveBeenCalled();
    const url = String(mockedAxios.post.mock.calls[0][0]);
    expect(url).toContain("cobrancas-h.api.efipay.com.br");
    expect(url).toContain("/v1/authorize");
    expect(url).not.toMatch(/charge|pix|boleto/i);
    expect(result.pix.validated).toBe(false);
    expect(result.cobrancas.ok).toBe(true);
    expect(row.pixHomologated).toBe(false);
    expect(row.adminEnabled).toBe(false);
    expect(JSON.stringify(result)).not.toContain("LEGACY_");
    expect(JSON.stringify(result)).not.toContain("access_token");
  });

  it("cadastro não ativa cobrança; activate exige confirm+auth+cert", async () => {
    row.clientIdEncrypted = encryptEfiSecret("id");
    row.clientSecretEncrypted = encryptEfiSecret("sec");
    row.status = "configured";
    await upsertEfiAdminConfig({
      slot: "homologation",
      actorUserId: 1,
      body: { pixKey: "chave" }
    });
    expect(row.adminEnabled).toBe(false);
    expect(row.pixHomologated).toBe(false);

    await expect(
      activateEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        confirm: false
      })
    ).rejects.toMatchObject({ message: "ERR_EFI_ACTIVATE_CONFIRM_REQUIRED" });

    row.lastAuthTestOk = true;
    await expect(
      activateEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        confirm: true
      })
    ).rejects.toMatchObject({ message: "ERR_EFI_CERTIFICATE_MISSING" });

    row.certificateEncrypted = encryptEfiSecret("not-really-cert-but-presence");
    // B3.1: a ativação abre o P12 de verdade (RF1.8).
    await expect(
      activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })
    ).rejects.toMatchObject({ message: "ERR_EFI_CERTIFICATE_INVALID" });
    expect(row.adminEnabled).toBe(false);

    row.certificateEncrypted = encryptEfiBinary(efiTestP12());
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { access_token: "pix-tok", expires_in: 3600 }
    });
    const dto = await activateEfiAdminConfig({
      slot: "homologation",
      actorUserId: 1,
      confirm: true
    });
    expect(dto.adminEnabled).toBe(true);
    expect(dto.pixOperational).toBe(false);
    expect(dto.diagnosticState).toBe("admin_enabled_awaiting_pix");
    expect(dto.checkoutUsesLegacyEnv).toBe(true);
  });

  it("revoke limpa secrets e audita sem plaintext", async () => {
    row.clientIdEncrypted = encryptEfiSecret("id");
    row.clientSecretEncrypted = encryptEfiSecret("sec");
    await revokeEfiAdminConfig({
      slot: "homologation",
      actorUserId: 1,
      confirm: true
    });
    expect(row.status).toBe("revoked");
    expect(row.clientIdEncrypted).toBeNull();
    expect(row.clientSecretEncrypted).toBeNull();
    const auditArg = auditCreate.mock.calls.find(
      (c: any[]) => c[0]?.action === "revoke"
    )?.[0];
    expect(JSON.stringify(auditArg || {})).not.toContain("efic1:");
  });
  describe("B3.1", () => {
    beforeEach(() => {
      row.clientIdEncrypted = encryptEfiSecret("db-client-id");
      row.clientSecretEncrypted = encryptEfiSecret("db-client-secret");
      row.certificateEncrypted = encryptEfiBinary(efiTestP12());
      row.certificateFingerprint = "a".repeat(64);
      row.lastAuthTestOk = true;
      row.status = "auth_validated";
    });

    it("T-CRED-14: webhook secret com menos de 32 caracteres → 400", async () => {
      await expect(
        upsertEfiAdminConfig({
          slot: "homologation",
          actorUserId: 1,
          body: { webhookSecret: "x".repeat(31) }
        })
      ).rejects.toMatchObject({ message: "ERR_EFI_WEBHOOK_SECRET_TOO_SHORT", statusCode: 400 });
      expect(transaction).not.toHaveBeenCalled();

      await upsertEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        body: { webhookSecret: "x".repeat(32) }
      });
      expect(row.webhookSecretConfigured).toBe(true);
    });

    it("T-CRED-12: test-auth valida P12 + OAuth Pix mTLS; resultado separado do Cobranças", async () => {
      // Simula a rejeição real do axios (HTTP 401) só para o OAuth Pix.
      mockedAxios.post.mockImplementation(async (url: string) => {
        if (String(url).includes("pix-h.api.efipay.com.br")) {
          throw { response: { status: 401, data: { error_description: "invalid_client" } } };
        }
        return { status: 200, data: { access_token: "cob", expires_in: 600 } } as any;
      });

      const result = await testEfiAdminAuth({ slot: "homologation", actorUserId: 1 });
      const pixCall = mockedAxios.post.mock.calls.find(c =>
        String(c[0]).startsWith("https://pix-h.api.efipay.com.br/oauth/token")
      );
      expect(pixCall).toBeDefined();
      expect((pixCall![2] as any).httpsAgent.options.pfx.equals(efiTestP12())).toBe(true);
      expect(result.cobrancas.ok).toBe(true);
      expect(result.pix).toMatchObject({ ok: false, certificateValid: true, validated: false });
      expect(row.lastAuthTestOk).toBe(true);
      const audit = auditCreate.mock.calls.find(c => c[0]?.action === "test_auth")?.[0];
      expect(JSON.parse(audit.diffSummary)).toMatchObject({ cobrancasOk: true, pixOk: false });
      expect(JSON.stringify(auditCreate.mock.calls)).not.toContain("db-client-secret");
    });

    it("RF1.8: ativação recusada se o OAuth Pix falhar", async () => {
      mockedAxios.post.mockRejectedValue({ response: { status: 401, data: {} } });
      await expect(
        activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })
      ).rejects.toMatchObject({ message: "ERR_EFI_PIX_AUTH_NOT_VALIDATED" });
      expect(row.adminEnabled).toBe(false);
      expect(row.save).not.toHaveBeenCalled();
    });

    it("ativação aborta (409) se a configuração mudou durante o teste Pix", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      findByPk.mockResolvedValue({
        ...row,
        clientSecretEncrypted: encryptEfiSecret("rotacionado-no-meio"),
        save: jest.fn()
      });
      await expect(
        activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })
      ).rejects.toMatchObject({ message: "ERR_EFI_CONFIG_CHANGED_DURING_ACTIVATION", statusCode: 409 });
      expect(tx.rollback).toHaveBeenCalled();
      expect(row.adminEnabled).toBe(false);
    });

    it("T-CRED-07/08: toda ação admin invalida o cache de credenciais", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      await upsertEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        body: { clientSecret: "new-secret" }
      });
      await uploadEfiCertificate({
        slot: "homologation",
        actorUserId: 1,
        buffer: efiTestP12(),
        originalName: "efi.p12"
      });
      row.lastAuthTestOk = true;
      await activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true });
      await deactivateEfiAdminConfig({ slot: "homologation", actorUserId: 1 });
      await deleteEfiCertificate({ slot: "homologation", actorUserId: 1 });
      await revokeEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true });
      expect(invalidateCache).toHaveBeenCalledTimes(6);
    });

    it("T-CERT-04/T-HOM-01: troca de P12 ou segredo muda o fingerprint e desabilita", async () => {
      row.adminEnabled = true;
      const before = computeEfiConfigFingerprint(row);
      await uploadEfiCertificate({
        slot: "homologation",
        actorUserId: 1,
        buffer: efiTestP12(),
        originalName: "efi.p12"
      });
      const afterCert = computeEfiConfigFingerprint(row);
      expect(afterCert).not.toBe(before);
      expect(row.adminEnabled).toBe(false);
      expect(row.lastAuthTestOk).toBeNull();

      await upsertEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        body: { pixKey: "nova-chave" }
      });
      expect(computeEfiConfigFingerprint(row)).not.toBe(afterCert);
    });

    it("T-CRED-16: status gravado pelo admin = status do resolvedor", async () => {
      await upsertEfiAdminConfig({
        slot: "homologation",
        actorUserId: 1,
        body: { pixKey: "chave" }
      });
      expect(row.status).toBe(derivePlatformEfiConfigStatus(row));
      await deleteEfiCertificate({ slot: "homologation", actorUserId: 1 });
      expect(row.status).toBe(derivePlatformEfiConfigStatus(row));
    });

    it("P-B31-03: ativação grava, na mesma transação, a validação Pix do fingerprint ativado", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      const fingerprint = computeEfiConfigFingerprint(row);
      await activateEfiAdminConfig({ slot: "homologation", actorUserId: 7, confirm: true });
      const call = auditCreate.mock.calls.find(c => c[0]?.action === "activate")!;
      expect(call[1]).toEqual({ transaction: tx });
      expect(call[0].actorUserId).toBe(7);
      expect(JSON.parse(call[0].diffSummary)).toMatchObject({
        pixOAuthValidated: true,
        configFingerprint: fingerprint,
        efiEnvironment: "sandbox"
      });
      expect(tx.commit).toHaveBeenCalled();
    });

    it("P-B31-03: falha ao gravar a validação desfaz a ativação", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      auditCreate.mockImplementation(async (values: any) => {
        if (values.action === "activate") throw new Error("audit down");
        return {};
      });
      await expect(
        activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })
      ).rejects.toThrow("audit down");
      expect(tx.rollback).toHaveBeenCalled();
      expect(tx.commit).not.toHaveBeenCalled();
      expect(invalidateCache).not.toHaveBeenCalled();
    });

    it("test-auth com P12 que não decifra → Pix falha tipada, sem 500", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "cob", expires_in: 600 }
      });
      row.certificateEncrypted = "efic1:corrompido-nao-decifra";
      const result = await testEfiAdminAuth({ slot: "homologation", actorUserId: 1 });
      expect(result.cobrancas.ok).toBe(true);
      expect(result.pix).toMatchObject({ ok: false, certificateValid: false, validated: false });
      expect(row.save).toHaveBeenCalled();
    });

    it("commit que falha propaga o erro original (rollback não o esconde)", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      tx.commit.mockRejectedValue(new Error("commit failed"));
      tx.rollback.mockRejectedValue(new Error("Transaction already finished"));
      await expect(
        activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })
      ).rejects.toThrow("commit failed");
      expect(invalidateCache).not.toHaveBeenCalled();
    });

    it("T-SEC-02: falha OAuth (Pix e Cobranças) não põe segredo, Bearer ou PEM nos logs", async () => {
      const leak =
        "client_secret=db-client-secret Bearer tok.abc.def -----BEGIN PRIVATE KEY-----MIIx-----END PRIVATE KEY-----";
      mockedAxios.post.mockRejectedValue({
        response: { status: 401, data: { error_description: leak } },
        message: leak
      });
      const { logger } = require("../../../utils/logger");
      const spies = ["info", "warn", "error", "debug"].map(level =>
        jest.spyOn(logger, level).mockImplementation(() => undefined)
      );
      const result = await testEfiAdminAuth({ slot: "homologation", actorUserId: 1 });
      expect(result.pix.ok).toBe(false);
      const logged = JSON.stringify(spies.map(s => s.mock.calls));
      const returned = JSON.stringify(result);
      const audited = JSON.stringify(auditCreate.mock.calls);
      for (const text of [logged, returned, audited]) {
        expect(text).not.toContain("db-client-secret");
        expect(text).not.toContain("tok.abc.def");
        expect(text).not.toContain("BEGIN PRIVATE KEY");
      }
      spies.forEach(s => s.mockRestore());
    });

    it("T-SEC-13: cada ação admin grava exatamente 1 auditoria, com o ator", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: "tok", expires_in: 3600 }
      });
      const actions: Array<[string, () => Promise<unknown>]> = [
        ["update", () =>
          upsertEfiAdminConfig({ slot: "homologation", actorUserId: 11, body: { pixKey: "chave-nova" } })],
        ["upload_cert", () =>
          uploadEfiCertificate({ slot: "homologation", actorUserId: 12, buffer: efiTestP12(), originalName: "e.p12" })],
        ["test_auth", () => testEfiAdminAuth({ slot: "homologation", actorUserId: 13 })],
        ["activate", () => activateEfiAdminConfig({ slot: "homologation", actorUserId: 14, confirm: true })],
        ["deactivate", () => deactivateEfiAdminConfig({ slot: "homologation", actorUserId: 15 })],
        ["delete_cert", () => deleteEfiCertificate({ slot: "homologation", actorUserId: 16 })],
        ["revoke", () => revokeEfiAdminConfig({ slot: "homologation", actorUserId: 17, confirm: true })]
      ];
      for (const [, run] of actions) {
        row.lastAuthTestOk = true;
        auditCreate.mockClear();
        __resetEfiAuthTestRateLimitForTests();
        await run();
        expect(auditCreate).toHaveBeenCalledTimes(1);
        expect(auditCreate.mock.calls[0][0].actorUserId).toEqual(expect.any(Number));
      }
    });
  });

  describe("B3.4 — API Efí de produção no runtime test (B34-T10)", () => {
    const fill = () => {
      row.clientIdEncrypted = encryptEfiSecret("Client_Id_x");
      row.clientSecretEncrypted = encryptEfiSecret("Client_Secret_x");
      row.clientIdMasked = "****id_x";
      row.pixKeyEncrypted = encryptEfiSecret("chave");
      row.pixKeyMasked = "****ave";
      row.webhookSecretEncrypted = encryptEfiSecret("w".repeat(40));
      row.webhookSecretConfigured = true;
      row.certificateEncrypted = encryptEfiBinary(fakeP12());
      row.certificateStorageKey = "homologation-abc.p12";
      row.certificateFingerprint = "f".repeat(64);
      row.certificateUploadedAt = new Date();
      row.lastAuthTestOk = true;
      row.lastAuthTestAt = new Date();
      row.lastAuthTestMessage = "ok";
      row.adminEnabled = true;
      row.pixHomologated = true;
      row.activatedAt = new Date();
      row.activatedByUserId = 1;
      row.status = "operational";
    };
    const change = (efiEnvironment: string, confirm = true) =>
      changeEfiApiEnvironment({ slot: "homologation", actorUserId: 7, efiEnvironment, confirm });
    const code = async (p: Promise<unknown>) => {
      try {
        await p;
      } catch (e) {
        return (e as AppError).message;
      }
      return "no-error";
    };

    it("cenário B: sem a autorização, test não troca para a API de produção", async () => {
      fill();
      expect(await code(change("production"))).toBe("ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME");
      expect(row.efiEnvironment).toBe("sandbox");
      expect(row.clientIdEncrypted).not.toBeNull();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it("cenários C e G: com a autorização troca, apaga credenciais/P12/testes e audita na transação", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      fill();
      const dto = await change("production");

      expect(row.efiEnvironment).toBe("production");
      for (const f of [
        "clientIdEncrypted", "clientSecretEncrypted", "clientIdMasked", "pixKeyEncrypted",
        "webhookSecretEncrypted", "certificateEncrypted", "certificateStorageKey",
        "certificateFingerprint", "lastAuthTestOk", "lastAuthTestAt", "activatedAt"
      ]) {
        expect(row[f]).toBeNull();
      }
      expect(row.webhookSecretConfigured).toBe(false);
      expect(row.adminEnabled).toBe(false);
      expect(row.pixHomologated).toBe(false);
      expect(row.status).toBe("empty");
      expect(tx.commit).toHaveBeenCalled();
      expect(invalidateCache).toHaveBeenCalled();

      expect(auditCreate).toHaveBeenCalledTimes(1);
      const [audit, opts] = auditCreate.mock.calls[0];
      expect(audit.action).toBe("change_environment");
      expect(audit.actorUserId).toBe(7);
      expect(opts?.transaction).toBe(tx);
      expect(JSON.parse(audit.diffSummary)).toMatchObject({
        fromEfiEnvironment: "sandbox",
        toEfiEnvironment: "production",
        productionApiInTestRuntime: true,
        credentialsCleared: true,
        previousCertificateFingerprint: "f".repeat(64)
      });
      expect(JSON.stringify(audit)).not.toContain("efic1:");

      expect(dto.efiEnvironment).toBe("production");
      expect(dto.efiApi.realMoneyWarning).toContain("dinheiro real");
      expect(dto.efiApi.environmentPermitted).toBe(true);
    });

    it("exige confirmação, valor válido e mudança real", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      expect(await code(change("production", false))).toBe("ERR_EFI_ENVIRONMENT_CONFIRM_REQUIRED");
      expect(await code(change("producao"))).toBe("ERR_EFI_ENVIRONMENT_INVALID");
      expect(await code(change("sandbox"))).toBe("ERR_EFI_ENVIRONMENT_UNCHANGED");
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it("só o valor exato true autoriza", async () => {
      for (const v of ["1", "yes", "TRUE ", ""]) {
        process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = v;
        const expected = v.trim().toLowerCase() === "true" ? "no-error" : "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME";
        row.efiEnvironment = "sandbox";
        expect(await code(change("production"))).toBe(expected);
      }
    });

    it("salvar credenciais preserva o ambiente do slot", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      row.efiEnvironment = "production";
      await upsertEfiAdminConfig({ slot: "homologation", actorUserId: 1, body: { clientId: "Client_Id_y" } });
      expect(row.efiEnvironment).toBe("production");
    });

    it("cenário E: autorização removida bloqueia o uso, sem fallback, e permite voltar ao sandbox", async () => {
      row.efiEnvironment = "production";
      fill();
      row.adminEnabled = false;
      expect(
        await code(upsertEfiAdminConfig({ slot: "homologation", actorUserId: 1, body: { pixKey: "k" } }))
      ).toBe("ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME");
      expect(await code(testEfiAdminAuth({ slot: "homologation", actorUserId: 1 }))).toBe(
        "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME"
      );
      expect(await code(activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true }))).toBe(
        "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME"
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();

      const dto = await getEfiAdminConfigSafe();
      expect(dto.efiApi.environmentPermitted).toBe(false);
      expect(dto.efiApi.permittedEnvironments).toEqual(["sandbox"]);

      await change("sandbox");
      expect(row.efiEnvironment).toBe("sandbox");
      expect(row.clientIdEncrypted).toBeNull();
      expect(row.certificateEncrypted).toBeNull();
    });

    it("test-auth com a autorização usa os endpoints de produção (Cobranças e Pix), nunca o legado", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      row.efiEnvironment = "production";
      row.clientIdEncrypted = encryptEfiSecret("Client_Id_db");
      row.clientSecretEncrypted = encryptEfiSecret("Client_Secret_db");
      row.certificateEncrypted = encryptEfiBinary(fakeP12());
      row.status = "configured";
      mockedAxios.post.mockResolvedValue({ status: 200, data: { access_token: "tok", expires_in: 600 } });

      await testEfiAdminAuth({ slot: "homologation", actorUserId: 1 });

      const urls = mockedAxios.post.mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.startsWith("https://cobrancas.api.efipay.com.br"))).toBe(true);
      expect(urls.some(u => u.startsWith("https://pix.api.efipay.com.br/oauth/token"))).toBe(true);
      expect(urls.some(u => /-h\.api\.efipay/.test(u))).toBe(false);
      expect(JSON.stringify(mockedAxios.post.mock.calls)).not.toContain("LEGACY_");
    });

    it("cenário D: runtime production ignora a autorização e segue só com production", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      row.slot = "production";
      row.efiEnvironment = "production";
      expect(
        await code(changeEfiApiEnvironment({ slot: "production", actorUserId: 1, efiEnvironment: "sandbox", confirm: true }))
      ).toBe("ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME");
      expect(await code(change("production"))).toBe("ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME");
      const dto = await getEfiAdminConfigSafe();
      expect(dto.efiApi.productionAllowedInTestRuntime).toBe(false);
      expect(dto.efiApi.realMoneyWarning).toBeNull();
    });
  });
});
