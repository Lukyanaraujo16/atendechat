import fs from "fs";
import path from "path";

/**
 * B3.1 — contrato do caminho legado (T-ACT-01, T-CERT-06) e isolamento financeiro (P-B31-08).
 * Checkout e webhook continuam no SDK + `config/Gn.ts`; a B3.1 não os liga ao provedor novo,
 * e `EFI_CREDENTIALS_SOURCE=database` não muda nenhuma resposta nem chamada financeira.
 */

const mockSdk = {
  pixCreateImmediateCharge: jest.fn(),
  pixGenerateQRCode: jest.fn(),
  pixConfigWebhook: jest.fn(),
  pixDetailCharge: jest.fn()
};
const mockGerencianet = jest.fn((_options: unknown) => mockSdk);
jest.mock("gn-api-sdk-typescript", () => (options: unknown) => mockGerencianet(options));
jest.mock("../../../models/Invoices", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../../models/SaaSPaymentAttempt", () => ({
  __esModule: true,
  default: { create: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/PlatformEfiConfig", () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock("../../../models/PlatformEfiConfigAudit", () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock("../confirmGatewayPayment", () => ({ confirmGatewayPayment: jest.fn() }));
// Ramo v2 (B3.2): só entra com a cobrança v2 ativa; aqui o gate real está desligado.
const mockCreateOrReuse = jest.fn();
jest.mock("../createOrReusePixCharge", () => ({
  createOrReusePixChargeV2: (...args: unknown[]) => mockCreateOrReuse(...args)
}));
// B3.3: recepção durável só com o pipeline async liberado; no default nunca é chamada.
const mockReceive = jest.fn();
jest.mock("../webhookReception", () => ({
  receiveGatewayWebhook: (...args: unknown[]) => mockReceive(...args)
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const SRC = path.join(__dirname, "../../..");
const B31_MODULES = /efiRuntimeCredentials|efiPixClient|efiConfigFingerprint|efiPixChargeGateway|getEfiActivationControls/;
const WH_SECRET = "w".repeat(40);

const LEGACY_ENV = {
  NODE_ENV: "test",
  STREAMHUB_RUNTIME_ENV: "test",
  EFI_PIX_ENABLED: "true",
  GERENCIANET_SANDBOX: "true",
  GERENCIANET_CLIENT_ID: "Client_Id_legacy",
  GERENCIANET_CLIENT_SECRET: "Client_Secret_legacy",
  GERENCIANET_PIX_CERT: "cert-legado",
  GERENCIANET_PIX_KEY: "chave-legado",
  WEBHOOK_SUBSCRIPTION_SECRET: WH_SECRET,
  BACKEND_URL: "https://api.exemplo.test"
};

function fakeRes() {
  const res: any = { statusCode: 200 };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

/** Roda checkout + webhook com o env dado e devolve tudo que é observável de fora. */
async function runFinancialFlows(env: Record<string, string>): Promise<Record<string, any>> {
  // Jest 27 não tem isolateModulesAsync: módulos novos a cada execução (Gn.ts lê o env no load).
  jest.resetModules();
  process.env = { ...env };
  jest.clearAllMocks();
  {
    const Invoices = require("../../../models/Invoices").default;
    const SaaSPaymentAttempt = require("../../../models/SaaSPaymentAttempt").default;
    const PlatformEfiConfig = require("../../../models/PlatformEfiConfig").default;
    const { confirmGatewayPayment } = require("../confirmGatewayPayment");
    const invoice = {
      id: 5,
      companyId: 1,
      status: "open",
      value: 10,
      externalTxid: null,
      update: jest.fn()
    };
    Invoices.findByPk.mockResolvedValue(invoice);
    mockSdk.pixCreateImmediateCharge.mockResolvedValue({
      txid: "tx-1",
      status: "ATIVA",
      chave: "chave-legado",
      loc: { id: 9 }
    });
    mockSdk.pixGenerateQRCode.mockResolvedValue({ qrcode: "000201", imagemQrcode: "data:img" });
    mockSdk.pixConfigWebhook.mockResolvedValue({});
    mockSdk.pixDetailCharge.mockResolvedValue({
      status: "CONCLUIDA",
      solicitacaoPagador: "#Fatura:5",
      valor: { original: "10.00" }
    });

    const controller = require("../../../controllers/SubscriptionController");

    const checkoutRes = fakeRes();
    await controller.createSubscription(
      { user: { companyId: 1 }, body: { invoiceId: 5, users: "1", connections: "1" } },
      checkoutRes
    );

    const unauthorized = fakeRes();
    await controller.webhook({ query: {}, headers: {}, body: { pix: [] } }, unauthorized);
    const ping = fakeRes();
    await controller.webhook(
      { query: { token: WH_SECRET }, headers: {}, body: { evento: "teste_webhook" } },
      ping
    );
    const paid = fakeRes();
    await controller.webhook(
      {
        query: {},
        headers: { authorization: `Bearer ${WH_SECRET}` },
        body: { pix: [{ txid: "tx-1", endToEndId: "E2E1" }] }
      },
      paid
    );

    const observed: Record<string, any> = {
      sdkOptions: mockGerencianet.mock.calls.map(c => c[0]),
      checkout: { status: checkoutRes.statusCode, body: checkoutRes.body },
      chargeBody: mockSdk.pixCreateImmediateCharge.mock.calls,
      webhookConfig: mockSdk.pixConfigWebhook.mock.calls,
      attemptCreate: SaaSPaymentAttempt.create.mock.calls,
      invoiceUpdate: invoice.update.mock.calls,
      webhook: [unauthorized, ping, paid].map(r => ({ status: r.statusCode, body: r.body })),
      detail: mockSdk.pixDetailCharge.mock.calls,
      confirm: confirmGatewayPayment.mock.calls,
      attemptUpdate: SaaSPaymentAttempt.update.mock.calls,
      dbReads: PlatformEfiConfig.findOne.mock.calls.length,
      v2Calls: mockCreateOrReuse.mock.calls.length
    };
    // T-ACT-06: com o pipeline no default (ou `async` sem liberação de código), só o legado responde.
    expect(mockReceive).not.toHaveBeenCalled();
    return observed;
  }
}

describe("B3.1 — contrato legado (controles no default)", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("T-ACT-01: checkout/webhook e Gn.ts não usam os módulos novos da B3.1", () => {
    for (const rel of ["controllers/SubscriptionController.ts", "config/Gn.ts"]) {
      const source = fs.readFileSync(path.join(SRC, rel), "utf8");
      expect(source).not.toMatch(B31_MODULES);
    }
    const controller = fs.readFileSync(path.join(SRC, "controllers/SubscriptionController.ts"), "utf8");
    expect(controller).toContain('import options from "../config/Gn"');
    // B3.2: do gate o controller só usa a decisão da v2; nunca a fonte de credenciais.
    // B3.3: do gate, só as decisões da v2 e do pipeline async; nunca a fonte de credenciais.
    // Produção (B34-T11): também a decisão de recadastrar o webhook legado.
    expect(controller).toMatch(
      /import \{\s*isEfiPixChargeV2Active,\s*isEfiWebhookPipelineAsyncActive,\s*isLegacyPixWebhookRegistrationAllowed\s*\} from "\.\.\/services\/SaasBilling\/efiFinancialSource"/
    );
    expect(controller).toMatch(
      /if \(isLegacyPixWebhookRegistrationAllowed\(\)\) \{\s*await gerencianet\.pixConfigWebhook\(params, bodyWebhook\);/
    );
    expect(controller).toMatch(/if \(isEfiWebhookPipelineAsyncActive\(\)\) \{\s*const reception = await receiveGatewayWebhook\(req\);/);
    expect(controller).not.toMatch(/getEfiFinancialCredentialsSource/);
  });

  it("P-B31-08: só efiCobrancasClient pede credencial financeira, e só atrás do gate", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === "__tests__" || e.name === "__integration__" ? [] : walk(full);
        return /\.ts$/.test(e.name) ? [full] : [];
      });
    const callers = walk(SRC)
      .filter(f => /getEfiRuntimeCredentials\(|resolveEfiCredentials\(/.test(fs.readFileSync(f, "utf8")))
      .map(f => path.relative(SRC, f))
      .sort();
    // Provedor e resolvedor (definições) + os consumidores financeiros (Cobranças, Pix v2).
    expect(callers).toEqual([
      "services/SaasBilling/efiCobrancasClient.ts",
      "services/SaasBilling/efiCredentialResolver.ts",
      "services/SaasBilling/efiPixChargeGateway.ts",
      "services/SaasBilling/efiRuntimeCredentials.ts",
      // B3.3: secret do webhook da fonte financeira efetiva, só atrás do gate.
      "services/SaasBilling/webhookReception.ts"
    ]);
    const reception = fs.readFileSync(path.join(SRC, "services/SaasBilling/webhookReception.ts"), "utf8");
    expect(reception).toMatch(
      /const source = getEfiFinancialCredentialsSource\(\);\s*if \(source === "database"\) \{\s*const creds = await getEfiRuntimeCredentials\("financial"\)/
    );
    const cobrancas = fs.readFileSync(path.join(SRC, "services/SaasBilling/efiCobrancasClient.ts"), "utf8");
    expect(cobrancas).toMatch(
      /if \(getEfiFinancialCredentialsSource\(\) === "database"\) \{\s*const creds = await getEfiRuntimeCredentials\("financial"\)/
    );
    const pix = fs.readFileSync(path.join(SRC, "services/SaasBilling/efiPixChargeGateway.ts"), "utf8");
    expect(pix).toMatch(
      /return getEfiFinancialCredentialsSource\(\) === "database" \? databaseGateway\(\) : legacyGateway\(\);/
    );
    expect(pix.match(/getEfiRuntimeCredentials\(/g)).toHaveLength(1);
    expect(pix).toContain('purpose: "financial" | "database" = "financial"');
    expect(pix).toContain("getEfiRuntimeCredentials(purpose)");
    // B34-T10d/T12: a finalidade `database` (slot do banco, nunca legado) só serve ao bootstrap admin:
    // consulta e cadastro do webhook e conferência do `homologate` — nunca a cobrança.
    expect(pix.match(/databaseGateway\("database"\)/g)).toHaveLength(1);
    const dbGatewayUsers = walk(SRC)
      .filter(f => /getEfiDatabasePixGateway\(/.test(fs.readFileSync(f, "utf8")))
      .map(f => path.relative(SRC, f))
      .sort();
    expect(dbGatewayUsers).toEqual([
      "services/SaasBilling/efiHomologationService.ts",
      "services/SaasBilling/efiPixAdminService.ts",
      "services/SaasBilling/efiPixChargeGateway.ts"
    ]);
    const homolog = fs.readFileSync(path.join(SRC, "services/SaasBilling/efiHomologationService.ts"), "utf8");
    expect(homolog).not.toMatch(/putCharge|putWebhook|qrCode/);
    const admin = fs.readFileSync(path.join(SRC, "services/SaasBilling/efiPixAdminService.ts"), "utf8");
    const slotCheck = admin.slice(admin.indexOf("export async function getEfiSlotWebhookForAdmin"));
    const slotCheckBody = slotCheck.slice(0, slotCheck.indexOf("\n}\n"));
    expect(slotCheckBody).toContain("getEfiDatabasePixGateway()");
    expect(slotCheckBody).not.toMatch(/putWebhook|putCharge|qrCode|recordEfiConfigAudit/);
    const register = admin.slice(admin.indexOf("export async function registerEfiWebhookForAdmin"));
    expect(register.slice(0, register.indexOf("\n}\n"))).not.toMatch(/putCharge|qrCode/);
  });

  it("T-ACT-01: contrato de checkout e webhook com os controles no default", async () => {
    const observed = await runFinancialFlows(LEGACY_ENV);
    expect(observed).toEqual({
      sdkOptions: [
        {
          sandbox: true,
          client_id: "Client_Id_legacy",
          client_secret: "Client_Secret_legacy",
          pix_cert: path.join(SRC, "../certs/cert-legado.p12")
        },
        expect.anything()
      ],
      checkout: {
        status: 200,
        body: {
          txid: "tx-1",
          status: "ATIVA",
          chave: "chave-legado",
          loc: { id: 9 },
          qrcode: { qrcode: "000201", imagemQrcode: "data:img" }
        }
      },
      chargeBody: [
        [
          null,
          {
            calendario: { expiracao: 3600 },
            valor: { original: "10.00" },
            chave: "chave-legado",
            solicitacaoPagador: "#Fatura:5"
          }
        ]
      ],
      webhookConfig: [
        [
          { chave: "chave-legado" },
          { webhookUrl: `https://api.exemplo.test/subscription/webhook?token=${WH_SECRET}` }
        ]
      ],
      attemptCreate: [
        [
          {
            companyId: 1,
            invoiceId: 5,
            method: "pix",
            status: "pending",
            externalTxid: "tx-1",
            gatewayProvider: "efi",
            gatewayStatus: "ATIVA",
            amount: 10,
            payloadSummary: { locId: 9, solicitacaoPagador: "#Fatura:5" }
          }
        ]
      ],
      invoiceUpdate: [
        [
          {
            externalTxid: "tx-1",
            gatewayProvider: "efi",
            gatewayStatus: "ATIVA",
            gatewaySyncStatus: "pending"
          }
        ]
      ],
      webhook: [
        { status: 401, body: { error: "ERR_WEBHOOK_UNAUTHORIZED" } },
        { status: 200, body: { ok: true } },
        { status: 200, body: { ok: true } }
      ],
      detail: [[{ txid: "tx-1" }]],
      confirm: [
        [
          {
            invoiceId: 5,
            amount: 10,
            method: "pix",
            externalTxid: "tx-1",
            gatewayProvider: "efi",
            gatewayStatus: "CONCLUIDA",
            metadata: { endToEndId: "E2E1" }
          }
        ]
      ],
      attemptUpdate: [
        [{ status: "completed", gatewayStatus: "CONCLUIDA" }, { where: { externalTxid: "tx-1" } }]
      ],
      dbReads: 0,
      v2Calls: 0
    });
    // As duas instâncias do SDK (checkout e webhook) usam as mesmas opções do env.
    expect(observed.sdkOptions[1]).toEqual(observed.sdkOptions[0]);
  });

  it("P-B31-08/B34-T11: fonte database efetiva com v2 desligada → checkout legado igual, sem recadastrar o webhook", async () => {
    const legacy = await runFinancialFlows(LEGACY_ENV);
    expect(legacy.webhookConfig).toHaveLength(1); // fonte legacy_env: recadastro legado mantido
    for (const runtime of ["test", "production"]) {
      const database = await runFinancialFlows({
        ...LEGACY_ENV,
        STREAMHUB_RUNTIME_ENV: runtime,
        EFI_CREDENTIALS_SOURCE: "database"
      });
      // Cobrança, QR, tentativa e webhook legado (env) idênticos; só o recadastro da URL legada some.
      expect({ ...database, webhookConfig: legacy.webhookConfig }).toEqual(legacy);
      expect(database.webhookConfig).toEqual([]);
      expect(database.dbReads).toBe(0);
    }
  });

  it("B34-T11: rollback para legacy_env volta a recadastrar o webhook legado", async () => {
    const rolledBack = await runFinancialFlows({ ...LEGACY_ENV, STREAMHUB_RUNTIME_ENV: "production" });
    expect(rolledBack.webhookConfig).toHaveLength(1);
    expect(rolledBack.webhookConfig[0][0]).toEqual({ chave: "chave-legado" });
  });

  it("T-ACT-04: EFI_PIX_CHARGE_V2_ENABLED=true sem liberação de código → contrato legado idêntico", async () => {
    const legacy = await runFinancialFlows(LEGACY_ENV);
    const v2Env = await runFinancialFlows({ ...LEGACY_ENV, EFI_PIX_CHARGE_V2_ENABLED: "true" });
    expect(v2Env).toEqual(legacy);
    expect(v2Env.webhookConfig).toHaveLength(1); // pixConfigWebhook mantido
    expect(v2Env.v2Calls).toBe(0);
  });

  it("T-CERT-06: P12 legado ausente → 400 ERR_SUBSCRIPTION_PIX_CREATE (comportamento atual)", async () => {
    jest.resetModules();
    process.env = { ...LEGACY_ENV, GERENCIANET_PIX_CERT: "nao-existe" };
    const Invoices = require("../../../models/Invoices").default;
    Invoices.findByPk.mockResolvedValue({ id: 5, companyId: 1, status: "open", value: 10 });
    mockSdk.pixCreateImmediateCharge.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory, open 'certs/nao-existe.p12'"), {
        code: "ENOENT"
      })
    );
    const { createSubscription } = require("../../../controllers/SubscriptionController");
    const req: any = { user: { companyId: 1 }, body: { invoiceId: 5, users: "1", connections: "1" } };
    await expect(createSubscription(req, fakeRes())).rejects.toMatchObject({
      message: "ERR_SUBSCRIPTION_PIX_CREATE",
      statusCode: 400
    });
  });
});
