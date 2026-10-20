import axios from "axios";
import { encryptEfiBinary, encryptEfiSecret } from "../../../helpers/efiCredentialCrypto";
import PlatformEfiConfig from "../../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../../models/PlatformEfiConfigAudit";
import sequelize from "../../../database";
import {
  activateEfiAdminConfig,
  deactivateEfiAdminConfig,
  deleteEfiCertificate,
  revokeEfiAdminConfig,
  uploadEfiCertificate,
  upsertEfiAdminConfig
} from "../PlatformEfiConfigAdminService";
import { __resetEfiAuthTestRateLimitForTests } from "../efiIntegrationStatus";
import {
  getEfiRuntimeCredentials,
  invalidateEfiRuntimeCredentialsCache
} from "../efiRuntimeCredentials";
import { createEfiPixClient } from "../efiPixClient";
import { buildValidEfiConfigRow, efiActivationAudit, efiTestP12 } from "./fixtures/efiTestP12";

/**
 * T-CRED-07/08 de ponta a ponta: serviço admin, provedor e cliente Pix reais; só modelos,
 * transação e HTTP simulados. Depois de cada ação admin, a próxima chamada refaz o OAuth.
 */
jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));
jest.mock("../../../models/PlatformEfiConfig", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/PlatformEfiConfigAudit", () => ({
  __esModule: true,
  default: { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() }
}));

const findOne = PlatformEfiConfig.findOne as jest.Mock;
const findByPk = PlatformEfiConfig.findByPk as jest.Mock;
const auditCreate = PlatformEfiConfigAudit.create as jest.Mock;
const auditFindOne = PlatformEfiConfigAudit.findOne as jest.Mock;
const transaction = sequelize.transaction as jest.Mock;

describe("T-CRED-07/08 — ação admin → próxima chamada refaz o OAuth", () => {
  const original = { ...process.env };
  let row: Record<string, any>;
  let tokenSeq = 0;

  beforeEach(() => {
    process.env = { ...original };
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    process.env.EFI_CREDENTIALS_SOURCE = "database";
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "b31-cache-e2e-key-32chars!!!!!";
    jest.restoreAllMocks();
    jest.clearAllMocks();
    __resetEfiAuthTestRateLimitForTests();
    invalidateEfiRuntimeCredentialsCache();

    row = buildValidEfiConfigRow(encryptEfiSecret, encryptEfiBinary);
    row.save = jest.fn().mockImplementation(async () => row);
    findOne.mockImplementation(async () => row);
    findByPk.mockImplementation(async () => row);
    auditCreate.mockResolvedValue({});
    // Validação Pix registrada para o estado atual da linha (P-B31-03).
    auditFindOne.mockImplementation(async (opts: any) =>
      opts?.where?.action === "activate" ? efiActivationAudit(row) : null
    );
    transaction.mockResolvedValue({
      LOCK: { UPDATE: "UPDATE" },
      commit: jest.fn(),
      rollback: jest.fn()
    });
    jest.spyOn(axios, "post").mockImplementation(async () => ({
      status: 200,
      data: { access_token: `tok-${++tokenSeq}`, expires_in: 3600 }
    }));
  });

  afterAll(() => {
    process.env = original;
  });

  type Creds = Awaited<ReturnType<typeof getEfiRuntimeCredentials>>;

  function pixToken(creds: Creds): Promise<string> {
    return createEfiPixClient({
      efiEnvironment: creds.efiEnvironment,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      pfx: (creds.certificate as { kind: "memory"; pfx: Buffer }).pfx,
      tokenCacheKey: creds.tokenCacheKey
    }).getAccessToken();
  }

  const ACTIONS: Array<[string, () => Promise<unknown>]> = [
    ["upsert de segredo (T-CRED-07)", () =>
      upsertEfiAdminConfig({ slot: "homologation", actorUserId: 1, body: { clientSecret: "novo-secret" } })],
    ["upload de P12", () =>
      uploadEfiCertificate({ slot: "homologation", actorUserId: 1, buffer: efiTestP12(), originalName: "e.p12" })],
    ["activate", () => activateEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })],
    ["deactivate", () => deactivateEfiAdminConfig({ slot: "homologation", actorUserId: 1 })],
    ["delete do P12", () => deleteEfiCertificate({ slot: "homologation", actorUserId: 1 })],
    ["revoke", () => revokeEfiAdminConfig({ slot: "homologation", actorUserId: 1, confirm: true })]
  ];

  it.each(ACTIONS)("%s invalida credencial e token", async (_label, action) => {
    const creds = await getEfiRuntimeCredentials("diagnostic");
    const primed = await pixToken(creds);
    expect(await pixToken(creds)).toBe(primed); // cache em uso antes da ação
    expect(await getEfiRuntimeCredentials("diagnostic")).toBe(creds);

    await action();

    // Token: mesma chave de cache de antes → OAuth novo (o token antigo foi descartado).
    const oauthBefore = (axios.post as jest.Mock).mock.calls.length;
    expect(await pixToken(creds)).not.toBe(primed);
    expect((axios.post as jest.Mock).mock.calls.length).toBe(oauthBefore + 1);

    // Credencial: recarregada do banco; ações que desabilitam a configuração fazem o
    // provedor recusar em vez de devolver a credencial antiga do cache.
    const next = await getEfiRuntimeCredentials("diagnostic").catch((err: any) => err);
    if (next instanceof Error) {
      expect((next as any).message).toMatch(/^ERR_EFI_/);
    } else {
      expect(next).not.toBe(creds);
    }
  });
});
