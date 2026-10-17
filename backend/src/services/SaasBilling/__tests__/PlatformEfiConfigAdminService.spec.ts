import axios from "axios";
import AppError from "../../../errors/AppError";
import { encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import sequelize from "../../../database";
import {
  activateEfiAdminConfig,
  getEfiAdminConfigSafe,
  revokeEfiAdminConfig,
  testEfiAdminAuth,
  uploadEfiCertificate,
  upsertEfiAdminConfig
} from "../PlatformEfiConfigAdminService";
import { __resetEfiAuthTestRateLimitForTests } from "../efiIntegrationStatus";

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

function fakeP12(): Buffer {
  const oid = Buffer.from([
    0x06, 0x08, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x0c, 0x01
  ]);
  return Buffer.concat([
    Buffer.from([0x30, 0x82]),
    Buffer.alloc(80, 0x01),
    oid,
    Buffer.alloc(40, 0x02)
  ]);
}

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
    // encryptEfiSecret makes efic1 for text — enough for hasEncrypted check
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
});
