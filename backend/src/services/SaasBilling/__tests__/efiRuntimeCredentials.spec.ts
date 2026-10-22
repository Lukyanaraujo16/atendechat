import fs from "fs";
import axios from "axios";
import { encryptEfiBinary, encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import {
  getEfiRuntimeCredentials,
  invalidateEfiRuntimeCredentialsCache
} from "../efiRuntimeCredentials";
import { computeEfiConfigFingerprint } from "../efiConfigFingerprint";
import { settleEfiCobrancasCharge } from "../efiCobrancasClient";
import * as efiFinancialSource from "../efiFinancialSource";
import { createEfiPixClient } from "../efiPixClient";
import {
  buildValidEfiConfigRow,
  EFI_B2_ACTIVATION_AUDIT,
  efiActivationAudit,
  efiTestP12,
  mockEfiAuditsByAction
} from "./fixtures/efiTestP12";

jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/PlatformEfiConfigAudit", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

const findOne = PlatformEfiConfig.findOne as jest.Mock;
const auditFindOne = PlatformEfiConfigAudit.findOne as jest.Mock;

const row = (overrides: Record<string, unknown> = {}) =>
  buildValidEfiConfigRow(encryptEfiSecret, encryptEfiBinary, overrides);

const homologateAudit = (r: Record<string, any>, extra: Record<string, unknown> = {}) => ({
  id: 99,
  createdAt: new Date("2026-10-21T00:00:00Z"),
  diffSummary: JSON.stringify({
    configFingerprint: computeEfiConfigFingerprint(r as any),
    efiEnvironment: r.efiEnvironment,
    commit: "abcdef1",
    ...extra
  })
});

/** Linha do slot + auditorias. Por padrão, ativação B3.1 válida para a linha. */
function setRow(
  r: Record<string, any> | null,
  audits: { activate?: unknown; homologate?: unknown } = {}
): void {
  findOne.mockResolvedValue(r);
  mockEfiAuditsByAction(auditFindOne, {
    activate: "activate" in audits ? audits.activate : r && efiActivationAudit(r),
    homologate: audits.homologate ?? null
  });
}

describe("B3.1 — getEfiRuntimeCredentials (D-P1/D-P2)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "b31-runtime-test-key-32chars!!";
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    // Env legado poluído: a fonte database não pode usar (T-SEC-03).
    process.env.GERENCIANET_CLIENT_ID = "LEGACY_ID";
    process.env.GERENCIANET_CLIENT_SECRET = "LEGACY_SECRET";
    process.env.GERENCIANET_PIX_KEY = "LEGACY_PIX";
    process.env.GERENCIANET_PIX_CERT = "legacy-cert";
    process.env.GERENCIANET_SANDBOX = "false";
    process.env.WEBHOOK_SUBSCRIPTION_SECRET = "LEGACY_WH";
    process.env.EFI_COBRANCAS_CLIENT_ID = "LEGACY_COB_ID";
    process.env.EFI_COBRANCAS_CLIENT_SECRET = "LEGACY_COB_SECRET";
    delete process.env.EFI_CREDENTIALS_SOURCE;
    jest.restoreAllMocks();
    findOne.mockReset();
    auditFindOne.mockReset().mockResolvedValue(null);
    invalidateEfiRuntimeCredentialsCache();
  });

  afterAll(() => {
    process.env = original;
  });

  describe("legacy_env (default)", () => {
    it("T-CRED-01/T-ACT-01: fonte ausente → env atual, sem tocar no banco", async () => {
      for (const purpose of ["financial", "diagnostic"] as const) {
        const creds = await getEfiRuntimeCredentials(purpose);
        expect(creds).toMatchObject({
          source: "legacy_env",
          efiEnvironment: "production",
          clientId: "LEGACY_ID",
          clientSecret: "LEGACY_SECRET",
          pixKey: "LEGACY_PIX",
          webhookSecret: "LEGACY_WH",
          cobrancasClientId: "LEGACY_COB_ID",
          configId: null,
          slot: null
        });
        expect(creds.certificate).toEqual({
          kind: "file",
          path: expect.stringMatching(/certs\/legacy-cert\.p12$/)
        });
      }
      expect(findOne).not.toHaveBeenCalled();
    });

    it("T-CRED-02: valor inválido → legacy_env", async () => {
      process.env.EFI_CREDENTIALS_SOURCE = "foo";
      expect((await getEfiRuntimeCredentials("diagnostic")).source).toBe("legacy_env");
    });

    it("env incompleto → erro tipado", async () => {
      delete process.env.GERENCIANET_CLIENT_SECRET;
      await expect(getEfiRuntimeCredentials("financial")).rejects.toMatchObject({
        message: "ERR_EFI_LEGACY_ENV_INCOMPLETE"
      });
    });
  });

  describe("P-B31-08: database não opera o financeiro na B3.1", () => {
    beforeEach(() => {
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      setRow(row());
    });

    it("liberação financeira desligada por constante de código", () => {
      expect(efiFinancialSource.EFI_RELEASED_RUNTIMES.databaseFinancial).toEqual([]);
      expect(efiFinancialSource.getEfiFinancialCredentialsSource()).toBe("legacy_env");
    });

    it("finalidade financial com database configurado → env, sem ler o banco", async () => {
      const creds = await getEfiRuntimeCredentials("financial");
      expect(creds).toMatchObject({ source: "legacy_env", clientId: "LEGACY_ID", configId: null });
      expect(findOne).not.toHaveBeenCalled();
      expect(auditFindOne).not.toHaveBeenCalled();
    });

    it("finalidade diagnostic continua lendo o slot do banco", async () => {
      await expect(getEfiRuntimeCredentials("diagnostic")).resolves.toMatchObject({
        source: "database",
        configId: 7
      });
    });
  });

  describe("B34-T10: API Efí de produção no runtime test", () => {
    const prodRow = () => row({ efiEnvironment: "production" });

    it("cenário C: autorizado, o slot homologation usa a base Pix de produção, nada do env", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      setRow(prodRow());
      const creds = await getEfiRuntimeCredentials("database");
      expect(creds).toMatchObject({ source: "database", slot: "homologation", efiEnvironment: "production" });
      expect(
        createEfiPixClient({
          efiEnvironment: creds.efiEnvironment,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          pfx: (creds.certificate as any).pfx
        }).baseURL
      ).toBe("https://pix.api.efipay.com.br");
      expect(JSON.stringify({ ...creds, certificate: null })).not.toContain("LEGACY_");
    });

    it("cenários B/E/I: sem a autorização bloqueia (inclusive com cache quente) e nunca cai no legado", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      setRow(prodRow());
      await getEfiRuntimeCredentials("database");

      delete process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API;
      for (const purpose of ["database", "diagnostic"] as const) {
        await expect(getEfiRuntimeCredentials(purpose)).rejects.toMatchObject({
          message: "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME"
        });
      }
    });

    it("cenário H: a autorização não libera fonte database, v2, pipeline nem varredura", async () => {
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
      process.env.EFI_WEBHOOK_PIPELINE = "async";
      process.env.EFI_PIX_RECONCILIATION_SWEEP_ENABLED = "true";
      expect(efiFinancialSource.getEfiFinancialCredentialsSource()).toBe("legacy_env");
      expect(efiFinancialSource.isEfiPixChargeV2Active()).toBe(false);
      expect(efiFinancialSource.isEfiWebhookPipelineAsyncActive()).toBe(false);
      expect(efiFinancialSource.isEfiPixReconciliationSweepActive()).toBe(false);
    });
  });

  describe("database (diagnostic)", () => {
    beforeEach(() => {
      process.env.EFI_CREDENTIALS_SOURCE = "database";
    });

    it("T-ENV-01/T-ENV-05/T-SEC-03/T-CERT-01: slot homologation, sandbox, P12 em memória, nada do env", async () => {
      const writes = [
        jest.spyOn(fs, "writeFileSync"),
        jest.spyOn(fs, "writeFile"),
        jest.spyOn(fs, "createWriteStream")
      ];
      setRow(row());
      const creds = await getEfiRuntimeCredentials("diagnostic");
      expect(creds).toMatchObject({
        source: "database",
        slot: "homologation",
        efiEnvironment: "sandbox",
        configId: 7,
        clientId: "Client_Id_FROM_DB_abc",
        clientSecret: "Client_Secret_FROM_DB_xyz",
        pixKey: "pix-key-db",
        cobrancasClientId: "Client_Id_FROM_DB_abc"
      });
      expect(creds.certificate.kind).toBe("memory");
      const pfx = (creds.certificate as any).pfx as Buffer;
      expect(pfx.equals(efiTestP12())).toBe(true);
      // T-ENV-01: as credenciais do slot levam à base Pix sandbox (PT-4).
      expect(
        createEfiPixClient({
          efiEnvironment: creds.efiEnvironment,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          pfx
        }).baseURL
      ).toBe("https://pix-h.api.efipay.com.br");
      expect(creds.configFingerprint).toHaveLength(64);
      expect(JSON.stringify({ ...creds, certificate: null })).not.toContain("LEGACY_");
      expect(findOne).toHaveBeenCalledWith({ where: { slot: "homologation" } });
      writes.forEach(w => expect(w).not.toHaveBeenCalled());
    });

    it("T-HOM-02: homologation opera com configuração válida, sem homologação", async () => {
      setRow(row());
      await expect(getEfiRuntimeCredentials("diagnostic")).resolves.toMatchObject({
        slot: "homologation"
      });
    });

    it("T-HOM-02/T-CRED-05/T-ENV-02: production sem homologação → bloqueado", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      setRow(row({ slot: "production", efiEnvironment: "production" }));
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED",
        statusCode: 403
      });
    });

    it("T-HOM-02/T-ENV-02: production com homologação do fingerprint atual → slot production, base produção", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      const r = row({ slot: "production", efiEnvironment: "production" });
      setRow(r, { homologate: homologateAudit(r) });
      const creds = await getEfiRuntimeCredentials("diagnostic");
      expect(creds).toMatchObject({ slot: "production", efiEnvironment: "production" });
      expect(auditFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { configId: 7, slot: "production", action: "homologate" }
        })
      );
      expect(
        createEfiPixClient({
          efiEnvironment: creds.efiEnvironment,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          pfx: (creds.certificate as any).pfx
        }).baseURL
      ).toBe("https://pix.api.efipay.com.br");
    });

    it("T-HOM-01: homologação de outro fingerprint/ambiente não vale", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      const r = row({ slot: "production", efiEnvironment: "production" });
      setRow(r, { homologate: homologateAudit(r, { configFingerprint: "outro" }) });
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED"
      });
      invalidateEfiRuntimeCredentialsCache();
      setRow(r, { homologate: homologateAudit(r, { efiEnvironment: "sandbox" }) });
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED"
      });
    });

    describe("P-B31-03: validação Pix da configuração atual", () => {
      it.each([
        ["ativação da B2 (sem fingerprint)", EFI_B2_ACTIVATION_AUDIT],
        ["sem nenhuma ativação registrada", null]
      ])("%s → ERR_EFI_PIX_VALIDATION_REQUIRED", async (_label, audit) => {
        setRow(row(), { activate: audit });
        await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
          message: "ERR_EFI_PIX_VALIDATION_REQUIRED",
          statusCode: 403
        });
      });

      it("validação de outro fingerprint, outro ambiente ou sem OAuth Pix não vale", async () => {
        const r = row();
        for (const extra of [
          { configFingerprint: "outro" },
          { efiEnvironment: "production" },
          { pixOAuthValidated: false }
        ]) {
          invalidateEfiRuntimeCredentialsCache();
          setRow(r, { activate: efiActivationAudit(r, extra) });
          await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
            message: "ERR_EFI_PIX_VALIDATION_REQUIRED"
          });
        }
      });

      it("troca de segredo depois da ativação invalida a validação", async () => {
        const r = row();
        const audit = efiActivationAudit(r);
        setRow(
          { ...r, pixKeyEncrypted: encryptEfiSecret("outra-chave"), updatedAt: new Date() },
          { activate: audit }
        );
        await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
          message: "ERR_EFI_PIX_VALIDATION_REQUIRED"
        });
      });
    });

    it("T-CRED-03: sem registro do slot → ERR_EFI_CONFIG_NOT_FOUND, sem fallback env", async () => {
      setRow(null);
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_CONFIG_NOT_FOUND"
      });
    });

    it("T-CRED-04: adminEnabled=false → erro tipado 4xx", async () => {
      setRow(row({ adminEnabled: false }));
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_CONFIG_NOT_ENABLED",
        statusCode: 403
      });
    });

    it("T-CRED-06: revogado → ERR_EFI_CONFIG_REVOKED", async () => {
      setRow(row({ status: "revoked" }));
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_CONFIG_REVOKED"
      });
    });

    it("T-CERT-02 e itens obrigatórios de D-P2", async () => {
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ certificateEncrypted: null }, "ERR_EFI_CERTIFICATE_MISSING"],
        [{ pixKeyEncrypted: null }, "ERR_EFI_PIX_KEY_MISSING"],
        [{ webhookSecretEncrypted: null }, "ERR_EFI_WEBHOOK_SECRET_MISSING"],
        [{ clientSecretEncrypted: null }, "ERR_EFI_CONFIG_INCOMPLETE"]
      ];
      for (const [overrides, code] of cases) {
        invalidateEfiRuntimeCredentialsCache();
        setRow(row({ ...overrides, updatedAt: new Date() }));
        await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
          message: code
        });
      }
    });

    it("T-CRED-10: chave de cifra errada → ERR_EFI_CREDENTIAL_DECRYPT_FAILED sem vazar ciphertext", async () => {
      setRow(row());
      process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "outra-chave-errada-32chars!!!!!";
      const err: any = await getEfiRuntimeCredentials("diagnostic").catch(e => e);
      expect(err.message).toBe("ERR_EFI_CREDENTIAL_DECRYPT_FAILED");
      expect(JSON.stringify(err)).not.toContain("efic1:");
    });

    it("T-ENV-03: runtime ausente → bloqueio total", async () => {
      delete process.env.STREAMHUB_RUNTIME_ENV;
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_STREAMHUB_RUNTIME_ENV_INVALID"
      });
      expect(findOne).not.toHaveBeenCalled();
    });

    it("T-ENV-04: efiEnvironment incompatível com o runtime", async () => {
      setRow(row({ efiEnvironment: "production" }));
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME"
      });
    });

    it("T-SEC-04: registro production em runtime test → 403", async () => {
      setRow(row({ slot: "production", efiEnvironment: "production" }));
      await expect(getEfiRuntimeCredentials("diagnostic")).rejects.toMatchObject({
        message: "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME",
        statusCode: 403
      });
    });

    it("T-CRED-07/08: cache por configId+updatedAt; mudança ou invalidação recarrega", async () => {
      const r = row();
      setRow(r);
      const a = await getEfiRuntimeCredentials("diagnostic");
      const b = await getEfiRuntimeCredentials("diagnostic");
      expect(b).toBe(a);

      setRow({ ...r, updatedAt: new Date("2026-10-20T11:00:00Z") }, { activate: efiActivationAudit(r) });
      const c = await getEfiRuntimeCredentials("diagnostic");
      expect(c).not.toBe(a);

      invalidateEfiRuntimeCredentialsCache();
      const d = await getEfiRuntimeCredentials("diagnostic");
      expect(d).not.toBe(c);
    });
  });

  describe("efiCobrancasClient (T-CRED-09/T-CRED-13)", () => {
    beforeEach(() => {
      process.env.EFI_COBRANCAS_SETTLE_ENABLED = "true";
      jest
        .spyOn(axios, "post")
        .mockResolvedValue({ data: { access_token: "cob-tok", expires_in: 600 } } as any);
      jest.spyOn(axios, "create").mockReturnValue({
        put: jest.fn().mockResolvedValue({ data: { ok: true } }),
        interceptors: { request: { use: jest.fn() } }
      } as any);
    });

    it("OAuth e chamadas Cobranças com teto total (signal)", async () => {
      process.env.EFI_COBRANCAS_CLIENT_ID = "SIGNAL_TEST_ID"; // evita token em cache de outro teste
      await settleEfiCobrancasCharge("123");
      expect((axios.post as jest.Mock).mock.calls[0][2].signal).toBeDefined();
      const instance = (axios.create as jest.Mock).mock.results[0].value;
      const interceptor = instance.interceptors.request.use.mock.calls[0][0];
      expect(interceptor({ url: "/x" }).signal).toBeDefined();
    });

    it("legacy_env: base por GERENCIANET_SANDBOX e credencial EFI_COBRANCAS_* (atual)", async () => {
      await settleEfiCobrancasCharge("123");
      const [url, , cfg] = (axios.post as jest.Mock).mock.calls[0];
      expect(url).toBe("https://cobrancas.api.efipay.com.br/v1/authorize");
      expect(cfg.headers.Authorization).toBe(
        `Basic ${Buffer.from("LEGACY_COB_ID:LEGACY_COB_SECRET").toString("base64")}`
      );
    });

    it("P-B31-08: EFI_CREDENTIALS_SOURCE=database → settle segue no env, sem ler o banco", async () => {
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      process.env.EFI_COBRANCAS_CLIENT_ID = "ISOLATION_TEST_ID"; // token próprio
      setRow(row());
      await settleEfiCobrancasCharge("123");
      const [url, , cfg] = (axios.post as jest.Mock).mock.calls[0];
      expect(url).toBe("https://cobrancas.api.efipay.com.br/v1/authorize");
      expect(cfg.headers.Authorization).toBe(
        `Basic ${Buffer.from("ISOLATION_TEST_ID:LEGACY_COB_SECRET").toString("base64")}`
      );
      expect(findOne).not.toHaveBeenCalled();
    });

    it("database liberado (simulação da B3.2/B3.3): base pelo slot; dedicada senão Pix", async () => {
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      jest.spyOn(efiFinancialSource, "getEfiFinancialCredentialsSource").mockReturnValue("database");
      setRow(row());
      await settleEfiCobrancasCharge("123");
      let [url, , cfg] = (axios.post as jest.Mock).mock.calls[0];
      expect(url).toBe("https://cobrancas-h.api.efipay.com.br/v1/authorize");
      expect(cfg.headers.Authorization).toBe(
        `Basic ${Buffer.from("Client_Id_FROM_DB_abc:Client_Secret_FROM_DB_xyz").toString("base64")}`
      );

      // Credencial dedicada + updatedAt novo → novo token com a dedicada.
      setRow(
        row({
          cobrancasClientIdEncrypted: encryptEfiSecret("COB_DB_ID"),
          cobrancasClientSecretEncrypted: encryptEfiSecret("COB_DB_SECRET"),
          updatedAt: new Date("2026-10-20T12:00:00Z")
        })
      );
      await settleEfiCobrancasCharge("123");
      expect(axios.post).toHaveBeenCalledTimes(2);
      [url, , cfg] = (axios.post as jest.Mock).mock.calls[1];
      expect(cfg.headers.Authorization).toBe(
        `Basic ${Buffer.from("COB_DB_ID:COB_DB_SECRET").toString("base64")}`
      );
    });
  });
});
