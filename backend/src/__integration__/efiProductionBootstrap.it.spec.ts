/**
 * Integração (Postgres real) — B3-FIX01: bootstrap da homologação no slot `production`.
 *
 * Reproduz o B2 de PRODUÇÃO (2026-10-24): runtime `production`, fonte `database`, v2 e pipeline
 * ligados pelos controles REAIS de ambiente (sem spies de gate), slot válido e ativo, ainda sem
 * `homologate`. Antes da correção o cadastro do webhook falhava com
 * ERR_EFI_INTEGRATION_NOT_HOMOLOGATED (dependência circular).
 *
 * A Efí é simulada só na camada HTTP: os dois factories de gateway chamam primeiro o resolvedor
 * REAL (`getEfiRuntimeCredentials`), como o `databaseGateway` real, então a regra D-P2 e a exigência
 * de homologação valem de verdade. Fluxo coberto: consulta → cadastro → recepção do `teste` →
 * conferência → homologação, e as cobranças/eventos financeiros bloqueados antes dela.
 */
import "express-async-errors";
import crypto from "crypto";
import request from "supertest";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import PlatformEfiConfig from "../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../models/PlatformEfiConfigAudit";
import SaaSPayment from "../models/SaaSPayment";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSGatewayWebhookEvent from "../models/SaaSGatewayWebhookEvent";
import saasFinanceRoutes from "../routes/saasFinanceRoutes";
import subscriptionRoutes from "../routes/subScriptionRoutes";
import * as gatewayModule from "../services/SaasBilling/efiPixChargeGateway";
import * as appBuildInfo from "../config/appBuildInfo";
import { encryptEfiBinary, encryptEfiSecret } from "../helpers/efiCredentialCrypto";
import { computeEfiConfigFingerprint } from "../services/SaasBilling/efiConfigFingerprint";
import { getEfiRuntimeCredentials } from "../services/SaasBilling/efiRuntimeCredentials";
import { getExpectedWebhookSecret } from "../services/SaasBilling/webhookReception";
import { createOrReusePixChargeV2 } from "../services/SaasBilling/createOrReusePixCharge";
import { processGatewayWebhookEvent } from "../services/SaasBilling/processGatewayWebhookEvent";
import { setGatewayWebhookQueueForTests } from "../libs/gatewayWebhookQueue";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  catchError,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));
jest.mock("../services/SaasBilling/efiPixChargeGateway", () => {
  const actual = jest.requireActual("../services/SaasBilling/efiPixChargeGateway");
  return { ...actual, getEfiPixChargeGateway: jest.fn(), getEfiDatabasePixGateway: jest.fn() };
});

const SECRET = "fix01-webhook-secret-0123456789abcdefghij";
const PIX_KEY = "chave-pix-fix01@example.test";
const COMMIT = "abcdef1234567890abcdef1234567890abcdef12";
const BACKEND = "https://api.producao.example.test";
const rnd = (n: number) => crypto.randomBytes(n).toString("hex").slice(0, n);

/** Efí em memória (uma conta): webhook por chave e cobranças por txid. */
function fakeEfi() {
  const charges = new Map<string, any>();
  const hooks: { webhookUrl?: string } = {};
  const http = {
    putCharge: jest.fn(async (txid: string, body: any) => {
      const cob = {
        txid,
        status: "ATIVA",
        valor: { original: body.valor.original },
        chave: body.chave,
        solicitacaoPagador: body.solicitacaoPagador,
        calendario: { criacao: new Date().toISOString(), expiracao: body.calendario.expiracao },
        loc: { id: 7 },
        pixCopiaECola: `00020101PIX${txid}`
      };
      charges.set(txid, cob);
      return { ...cob };
    }),
    getCharge: jest.fn(async (txid: string) => (charges.has(txid) ? { ...charges.get(txid) } : null)),
    qrCode: jest.fn(async () => ({ qrcode: "qr", imagemQrcode: "img" })),
    putWebhook: jest.fn(async (_chave: string, url: string) => {
      hooks.webhookUrl = url;
    }),
    getWebhook: jest.fn(async () => (hooks.webhookUrl ? { webhookUrl: hooks.webhookUrl } : null))
  };
  /** Como `databaseGateway(purpose)`: resolvedor real primeiro, depois a camada HTTP. */
  const gatewayFor = async (purpose: "financial" | "database") => {
    const creds = await getEfiRuntimeCredentials(purpose);
    return {
      context: {
        source: creds.source,
        configId: creds.configId,
        slot: creds.slot,
        efiEnvironment: creds.efiEnvironment,
        configFingerprint: creds.configFingerprint,
        pixKey: creds.pixKey
      },
      ...http
    };
  };
  return { http, charges, hooks, gatewayFor };
}

describe("B3-FIX01 — bootstrap da homologação em PRODUÇÃO (Postgres real, Efí simulada)", () => {
  const app = buildApp([saasFinanceRoutes, subscriptionRoutes]);
  const originalEnv = { ...process.env };
  let efi: ReturnType<typeof fakeEfi>;
  let queue: { add: jest.Mock };
  let superUser: any;
  let superToken: string;
  let companyId: number;
  let seq = 0;

  const auth = (r: request.Test) => r.set("Authorization", `Bearer ${superToken}`);
  const inv = () => createOpenInvoice(companyId, { value: 100, dueDate: daysFromToday(-(++seq) * 32) });
  const postWebhook = (body: unknown, query = `?whToken=${encodeURIComponent(SECRET)}&ignorar=/pix`) =>
    request(app).post(`/subscription/webhook${query}`).send(body as any);
  /** A Efí acrescenta `/pix` ao fim da URL cadastrada. */
  const postToRegisteredUrl = (body: unknown) => {
    const u = new URL(efi.hooks.webhookUrl!);
    return request(app).post(`${u.pathname}${u.search}/pix`).send(body as any);
  };
  const testeNotification = () => ({ evento: "teste_webhook", data_criacao: new Date().toISOString() });
  const pixItem = (txid: string, e2e: string, valor = "100.00") => ({
    endToEndId: e2e,
    txid,
    chave: PIX_KEY,
    valor,
    horario: new Date().toISOString()
  });
  const financialCounts = async () => ({
    payments: await SaaSPayment.count(),
    attempts: await SaaSPaymentAttempt.count(),
    paidInvoices: await Invoices.count({ where: { status: "paid" } })
  });

  /** Slot `production` válido e ativado (validação Pix registrada), sem `homologate`. */
  async function productionSlot(over: Record<string, unknown> = {}) {
    const row = await PlatformEfiConfig.create({
      slot: "production",
      efiEnvironment: "production",
      status: "auth_validated",
      clientIdEncrypted: encryptEfiSecret("Client_Id_fix01"),
      clientSecretEncrypted: encryptEfiSecret("Client_Secret_fix01"),
      clientIdMasked: "****ix01",
      pixKeyEncrypted: encryptEfiSecret(PIX_KEY),
      pixKeyMasked: "****test",
      webhookSecretEncrypted: encryptEfiSecret(SECRET),
      webhookSecretConfigured: true,
      certificateEncrypted: encryptEfiBinary(Buffer.from("p12-fake-fix01")),
      certificateFingerprint: "fp-fix01",
      adminEnabled: true,
      activatedAt: new Date(Date.now() - 60000),
      lastAuthTestOk: true,
      ...over
    } as any);
    const fingerprint = computeEfiConfigFingerprint(row);
    await PlatformEfiConfigAudit.create({
      configId: row.id,
      slot: "production",
      action: "activate",
      diffSummary: JSON.stringify({ pixOAuthValidated: true, configFingerprint: fingerprint, efiEnvironment: "production" })
    } as any);
    return { row, fingerprint };
  }

  async function dropSlots() {
    await PlatformEfiConfigAudit.destroy({ where: {} });
    await PlatformEfiConfig.destroy({ where: {} });
  }

  /** Cadastro → `teste` recebido → `homologate`, pelas rotas reais. */
  async function homologateViaPanel(): Promise<number> {
    expect((await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }))).status).toBe(200);
    expect((await postToRegisteredUrl(testeNotification())).status).toBe(200);
    const teste = await SaaSGatewayWebhookEvent.findOne({ where: { eventType: "teste" }, order: [["id", "DESC"]] });
    const res = await auth(
      request(app)
        .post("/saas/finance/efi/config/production/homologate")
        .send({
          confirm: true,
          evidence: {
            testReportRef: "docs/FASE-8.3-B3-EFI/RELATORIO-HOMOLOGACAO.md",
            testReportCommit: COMMIT.slice(0, 7),
            testEventId: teste!.id
          }
        })
    );
    expect(res.status).toBe(200);
    return teste!.id;
  }

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUser = await createUser({ companyId: host.id, superUser: true });
    superToken = tokenFor(superUser);
  });

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      // Controles reais de PRODUÇÃO no B2 (IMPLANTACAO-PRODUCAO §5); nenhum gate é simulado.
      STREAMHUB_RUNTIME_ENV: "production",
      EFI_CREDENTIALS_SOURCE: "database",
      EFI_PIX_CHARGE_V2_ENABLED: "true",
      EFI_WEBHOOK_PIPELINE: "async",
      BACKEND_URL: BACKEND,
      EFI_CREDENTIAL_ENCRYPTION_KEY: "fix01-encryption-key-0123456789abcdef",
      SAAS_BILLING_AUTO_RENEW_ON_PAYMENT: "true"
    };
    delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
    jest.restoreAllMocks();
    efi = fakeEfi();
    (gatewayModule.getEfiPixChargeGateway as jest.Mock).mockImplementation(() => efi.gatewayFor("financial"));
    (gatewayModule.getEfiDatabasePixGateway as jest.Mock).mockImplementation(() => efi.gatewayFor("database"));
    queue = { add: jest.fn(async () => ({})) };
    setGatewayWebhookQueueForTests(queue as any);
    jest.spyOn(appBuildInfo, "getAppBuildInfo").mockReturnValue({
      commit: COMMIT,
      source: "build_info",
      dirty: false,
      builtAt: null
    });
    await SaaSGatewayWebhookEvent.update(
      { status: "ignored_not_saas" } as any,
      { where: { status: ["received", "retry_scheduled", "processing"] } }
    );
    await dropSlots();
    companyId = (await createCompany({ dueDate: daysFromToday(-3) })).id;
  });

  afterAll(async () => {
    process.env = originalEnv;
    setGatewayWebhookQueueForTests(null);
    await sequelize.close();
  });

  describe("Cenário A — PRODUÇÃO ainda não homologada", () => {
    it("A1: o segredo do slot é resolvido para o fluxo admin, mas a finalidade financeira segue bloqueada", async () => {
      await productionSlot();
      expect(await getExpectedWebhookSecret()).toEqual({ secret: SECRET, source: "database" });
      expect((await catchError(getEfiRuntimeCredentials("financial"))).message).toBe("ERR_EFI_INTEGRATION_NOT_HOMOLOGATED");
    });

    it("A2–A5: consulta → cadastro → teste recebido → conferência → homologação, ponta a ponta", async () => {
      const { fingerprint } = await productionSlot();
      const before = await financialCounts();

      // Consulta do painel (habilita o botão "Cadastrar webhook").
      const consult = await auth(request(app).get("/saas/finance/efi/webhook"));
      expect(consult.status).toBe(200);
      expect(consult.body).toMatchObject({ registered: false, registerAvailable: true, credentialsSource: "database", efiEnvironment: "production" });

      // Cadastro: sem ERR_EFI_INTEGRATION_NOT_HOMOLOGATED, URL nova com o secret do slot.
      const reg = await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      expect(reg.status).toBe(200);
      expect(reg.body).toMatchObject({ registered: true, conferred: true, urlFormat: "whToken_ignorar", credentialsSource: "database" });
      expect(efi.hooks.webhookUrl).toBe(`${BACKEND}/subscription/webhook?whToken=${encodeURIComponent(SECRET)}&ignorar=`);
      expect(JSON.stringify(reg.body)).not.toContain(SECRET);
      const regAudit = await PlatformEfiConfigAudit.findOne({ where: { action: "webhook_register" } });
      expect(JSON.parse(regAudit!.diffSummary!)).toMatchObject({ conferred: true, credentialsSource: "database" });
      expect(regAudit!.diffSummary).not.toContain(SECRET);

      // Notificação de teste da Efí na URL cadastrada: 200 e persistida, sem job.
      const teste = await postToRegisteredUrl(testeNotification());
      expect(teste.status).toBe(200);
      expect(teste.body).toEqual({ ok: true, received: true });
      const event = await SaaSGatewayWebhookEvent.findOne({ where: { eventType: "teste" }, order: [["id", "DESC"]] });
      expect(event).toMatchObject({ status: "ignored_not_saas", credentialsSource: "database" });
      expect((event!.payload as any).authVia).toBe("whToken");
      expect(queue.add).not.toHaveBeenCalled();

      // Conferência só leitura do painel.
      const check = await auth(request(app).get("/saas/finance/efi/config/webhook-check"));
      expect(check.status).toBe(200);
      expect(check.body).toMatchObject({ registered: true, pointsToThisBackend: true });
      expect(JSON.stringify(check.body)).not.toContain(SECRET);

      // Homologação administrativa.
      const hom = await auth(
        request(app)
          .post("/saas/finance/efi/config/production/homologate")
          .send({
            confirm: true,
            evidence: {
              testReportRef: "docs/FASE-8.3-B3-EFI/RELATORIO-HOMOLOGACAO.md",
              testReportCommit: COMMIT.slice(0, 7),
              testEventId: event!.id
            }
          })
      );
      expect(hom.status).toBe(200);
      expect(hom.body).toMatchObject({ homologated: true, configFingerprint: fingerprint, commit: COMMIT });
      expect(hom.body.evidence).toMatchObject({ testEventId: event!.id, webhookConferred: true });
      expect(JSON.stringify(hom.body)).not.toContain(SECRET);

      // Nada financeiro mudou no bootstrap.
      expect(await financialCounts()).toEqual(before);
      expect(efi.http.putCharge).not.toHaveBeenCalled();
    });

    it("A6: cobrança antes da homologação → ERR_EFI_INTEGRATION_NOT_HOMOLOGATED, sem tentativa nem chamada à Efí", async () => {
      await productionSlot();
      await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      const invoice = await inv();
      const err = await catchError(createOrReusePixChargeV2({ invoiceId: invoice.id, companyId }));
      expect(err.message).toBe("ERR_EFI_INTEGRATION_NOT_HOMOLOGATED");
      expect(await SaaSPaymentAttempt.count({ where: { invoiceId: invoice.id } })).toBe(0);
      expect(efi.http.putCharge).not.toHaveBeenCalled();
      expect((await invoice.reload()).externalTxid).toBeNull();
    });

    it("A7: Pix recebido antes da homologação é gravado mas não liquida; após homologar, é aplicado", async () => {
      await productionSlot();
      await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      const invoice = await inv();
      const txid = `shc${rnd(28)}`;
      const e2e = `E${rnd(31)}`;
      // Cobrança paga na conta (ex.: aberta antes da ativação) com tentativa local.
      await SaaSPaymentAttempt.create({
        companyId,
        invoiceId: invoice.id,
        method: "pix",
        status: "pending",
        externalTxid: txid,
        gatewayProvider: "efi",
        gatewayStatus: "ATIVA",
        amount: 100,
        payloadSummary: { chargeVersion: 2, source: "database", efiEnvironment: "production" }
      } as any);
      efi.charges.set(txid, {
        txid,
        status: "CONCLUIDA",
        valor: { original: "100.00" },
        chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${invoice.id}`,
        calendario: { criacao: new Date().toISOString(), expiracao: 3600 },
        pix: [{ endToEndId: e2e, valor: "100.00", horario: new Date().toISOString() }]
      });
      const before = await financialCounts();

      const res = await postToRegisteredUrl({ pix: [pixItem(txid, e2e)] });
      expect(res.status).toBe(200);
      const event = await SaaSGatewayWebhookEvent.findOne({ where: { eventKey: `pix:${e2e}` } });
      expect(event!.status).toBe("received");

      const first = await processGatewayWebhookEvent(event!.id, { workerId: "w-fix01" });
      expect(first.outcome).toBe("retry_scheduled");
      await event!.reload();
      expect(event!.status).toBe("retry_scheduled");
      expect(event!.paymentId).toBeNull();
      expect((await invoice.reload()).status).toBe("open");
      expect(await financialCounts()).toEqual(before);

      await homologateViaPanel();
      await event!.update({ nextAttemptAt: new Date(Date.now() - 1000) } as any);
      const second = await processGatewayWebhookEvent(event!.id, { workerId: "w-fix01" });
      expect(second.outcome).toBe("applied");
      expect((await invoice.reload()).status).toBe("paid");
      expect(await SaaSPayment.count({ where: { externalTxid: txid } })).toBe(1);
    });
  });

  describe("Cenário B — PRODUÇÃO homologada", () => {
    it("B1: após homologar, a cobrança v2 é criada com o slot e a baixa pelo webhook funciona", async () => {
      await productionSlot();
      await homologateViaPanel();
      const invoice = await inv();
      const charge = await createOrReusePixChargeV2({ invoiceId: invoice.id, companyId });
      expect(charge).toMatchObject({ status: "ATIVA", reused: false });
      const [attempt] = await SaaSPaymentAttempt.findAll({ where: { invoiceId: invoice.id } });
      expect(attempt.payloadSummary).toMatchObject({ source: "database", slot: "production", efiEnvironment: "production" });

      const e2e = `E${rnd(31)}`;
      const cob = efi.charges.get(charge.txid);
      efi.charges.set(charge.txid, { ...cob, status: "CONCLUIDA", pix: [{ endToEndId: e2e, valor: "100.00", horario: new Date().toISOString() }] });
      expect((await postToRegisteredUrl({ pix: [pixItem(charge.txid, e2e)] })).status).toBe(200);
      const event = await SaaSGatewayWebhookEvent.findOne({ where: { eventKey: `pix:${e2e}` } });
      expect((await processGatewayWebhookEvent(event!.id, { workerId: "w-fix01" })).outcome).toBe("applied");
      expect((await invoice.reload()).status).toBe("paid");
    });

    it("B2: depois de homologada, desativar o slot ou trocar o segredo volta a bloquear a cobrança", async () => {
      const { row } = await productionSlot();
      await homologateViaPanel();
      await row.update({ adminEnabled: false });
      const a = await inv();
      expect((await catchError(createOrReusePixChargeV2({ invoiceId: a.id, companyId }))).message).toBe("ERR_EFI_CONFIG_NOT_ENABLED");

      await row.update({ adminEnabled: true, webhookSecretEncrypted: encryptEfiSecret("outro-secret-com-mais-de-32-caracteres!!") });
      const b = await inv();
      // Fingerprint novo: a validação Pix e a homologação anteriores não valem mais.
      expect((await catchError(createOrReusePixChargeV2({ invoiceId: b.id, companyId }))).message).toBe("ERR_EFI_PIX_VALIDATION_REQUIRED");
      expect(efi.http.putCharge).not.toHaveBeenCalled();
    });
  });

  describe("Cenário C — segurança", () => {
    const expectNoReception = async (res: request.Response, status: number) => {
      expect(res.status).toBe(status);
      expect(await SaaSGatewayWebhookEvent.count({ where: { status: "received" } })).toBe(0);
    };

    it("C1: slot ausente → sem segredo, recepção 503, cadastro recusado sem chamar a Efí", async () => {
      expect((await catchError(getExpectedWebhookSecret())).message).toBe("ERR_EFI_CONFIG_NOT_FOUND");
      await expectNoReception(await postWebhook(testeNotification()), 503);
      const reg = await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      expect(reg.body.error).toBe("ERR_EFI_CONFIG_NOT_FOUND");
      expect(efi.http.putWebhook).not.toHaveBeenCalled();
    });

    it("C2: slot desativado → recepção 503 e cadastro recusado", async () => {
      await productionSlot({ adminEnabled: false });
      expect((await catchError(getExpectedWebhookSecret())).message).toBe("ERR_EFI_CONFIG_NOT_ENABLED");
      await expectNoReception(await postWebhook(testeNotification()), 503);
      const reg = await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      expect(reg.body.error).toBe("ERR_EFI_CONFIG_NOT_ENABLED");
      expect(efi.http.putWebhook).not.toHaveBeenCalled();
    });

    it("C3: credenciais inválidas (revogada; alterada sem nova validação Pix) → recusado", async () => {
      const { row } = await productionSlot({ status: "revoked" });
      expect((await catchError(getExpectedWebhookSecret())).message).toBe("ERR_EFI_CONFIG_REVOKED");
      await row.update({ status: "auth_validated", clientSecretEncrypted: encryptEfiSecret("Client_Secret_trocado") });
      expect((await catchError(getExpectedWebhookSecret())).message).toBe("ERR_EFI_PIX_VALIDATION_REQUIRED");
      await expectNoReception(await postWebhook(testeNotification()), 503);
    });

    it("C4: segredo incorreto ou ausente → 401 e nada gravado", async () => {
      await productionSlot();
      const before = await SaaSGatewayWebhookEvent.count();
      expect((await postWebhook(testeNotification(), "?whToken=errado-errado-errado-errado-errado&ignorar=/pix")).status).toBe(401);
      expect((await postWebhook(testeNotification(), "")).status).toBe(401);
      expect(await SaaSGatewayWebhookEvent.count()).toBe(before);
    });

    it("C5: runtime inválido ou de outro slot → nada do slot production é usado", async () => {
      await productionSlot();
      process.env.STREAMHUB_RUNTIME_ENV = "";
      expect((await catchError(getEfiRuntimeCredentials("database"))).message).toBe("ERR_STREAMHUB_RUNTIME_ENV_INVALID");
      // Sem runtime válido a fonte efetiva cai para legacy_env: o secret do slot nunca autentica.
      expect(await getExpectedWebhookSecret()).toEqual({ secret: null, source: "legacy_env" });
      const reg = await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      expect(reg.body.error).toBe("ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2");

      process.env.STREAMHUB_RUNTIME_ENV = "test";
      expect((await catchError(getExpectedWebhookSecret())).message).toBe("ERR_EFI_CONFIG_NOT_FOUND");
      expect(efi.http.putWebhook).not.toHaveBeenCalled();
    });

    it("C6: o evento teste não libera liquidação nem cobrança", async () => {
      await productionSlot();
      await auth(request(app).post("/saas/finance/efi/webhook/register").send({ confirm: true }));
      const before = await financialCounts();
      expect((await postToRegisteredUrl(testeNotification())).status).toBe(200);
      expect(queue.add).not.toHaveBeenCalled();
      expect(await financialCounts()).toEqual(before);
      expect((await catchError(getEfiRuntimeCredentials("financial"))).message).toBe("ERR_EFI_INTEGRATION_NOT_HOMOLOGATED");
    });
  });
});
