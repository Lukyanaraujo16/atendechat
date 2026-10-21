/**
 * Integração (Postgres real) — administração do pipeline, conciliação, varredura e homologação (B3.3).
 * Efí SEMPRE simulada; pipeline e varredura ligados só no teste (spies dos gates de código).
 */
import "express-async-errors";
import crypto from "crypto";
import request from "supertest";
import sequelize from "../database";
import PlatformEfiConfig from "../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../models/PlatformEfiConfigAudit";
import SaaSFinancialEvent from "../models/SaaSFinancialEvent";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import SaaSSubscriptionRenewal from "../models/SaaSSubscriptionRenewal";
import SaaSGatewayWebhookEvent from "../models/SaaSGatewayWebhookEvent";
import saasFinanceRoutes from "../routes/saasFinanceRoutes";
import * as efiFinancialSource from "../services/SaasBilling/efiFinancialSource";
import * as gatewayModule from "../services/SaasBilling/efiPixChargeGateway";
import * as appBuildInfo from "../config/appBuildInfo";
import { encryptEfiSecret } from "../helpers/efiCredentialCrypto";
import { computeEfiConfigFingerprint } from "../services/SaasBilling/efiConfigFingerprint";
import { findEfiHomologationForConfig } from "../services/SaasBilling/efiCredentialResolver";
import { getEfiIntegrationStatus } from "../services/SaasBilling/efiIntegrationStatus";
import { registerEfiWebhookForAdmin } from "../services/SaasBilling/efiPixAdminService";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { listCompanyReconciliation } from "../services/SaasBilling/ListCompanyFinanceService";
import { setGatewayWebhookQueueForTests } from "../libs/gatewayWebhookQueue";
import { buildSubscriptionWebhookUrlV2 } from "../services/SaasBilling/subscriptionWebhookUrl";
import * as efiRuntimeCredentials from "../services/SaasBilling/efiRuntimeCredentials";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));
jest.mock("../services/SaasBilling/efiPixChargeGateway", () => {
  const actual = jest.requireActual("../services/SaasBilling/efiPixChargeGateway");
  return { ...actual, getEfiPixChargeGateway: jest.fn() };
});

const SECRET = "it-webhook-secret-0123456789abcdefghijkl";
const PIX_KEY = "chave-pix-it@example.test";
const COMMIT = "abcdef1234567890abcdef1234567890abcdef12";
const rnd = (n: number) => crypto.randomBytes(n).toString("hex").slice(0, n);

function fakeEfi() {
  const charges = new Map<string, any>();
  const hooks: { webhookUrl?: string } = {};
  const gw = {
    context: {
      source: "legacy_env" as const,
      configId: null,
      slot: null,
      efiEnvironment: "sandbox" as const,
      configFingerprint: null,
      pixKey: PIX_KEY
    },
    getCharge: jest.fn(async (txid: string) => (charges.has(txid) ? { ...charges.get(txid) } : null)),
    putCharge: jest.fn(),
    qrCode: jest.fn(),
    putWebhook: jest.fn(async (_k: string, url: string) => {
      hooks.webhookUrl = url;
    }),
    getWebhook: jest.fn(async () => (hooks.webhookUrl ? { webhookUrl: hooks.webhookUrl } : null))
  };
  return { gw, charges, hooks };
}

describe("B3.3 — administração, conciliação, varredura e homologação (Postgres real)", () => {
  const app = buildApp([saasFinanceRoutes]);
  const originalEnv = { ...process.env };
  let efi: ReturnType<typeof fakeEfi>;
  let superUser: any;
  let tenantUser: any;
  let superToken: string;
  const auth = (r: request.Test, token = superToken) => r.set("Authorization", `Bearer ${token}`);
  const mkEvent = (over: Record<string, unknown> = {}) =>
    SaaSGatewayWebhookEvent.create({
      eventKey: `pix:E${rnd(31)}`,
      eventType: "pix",
      status: "unlinked",
      endToEndId: `E${rnd(31)}`,
      amount: 50,
      nextAttemptAt: new Date(),
      receivedAt: new Date(),
      payload: { chaveHash: "deadbeef", chaveMasked: "****test" },
      ...over
    } as any);

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUser = await createUser({ companyId: host.id, superUser: true });
    tenantUser = await createUser({ companyId: host.id, profile: "admin" });
    superToken = tokenFor(superUser);
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STREAMHUB_RUNTIME_ENV: "test",
      WEBHOOK_SUBSCRIPTION_SECRET: SECRET,
      BACKEND_URL: "https://api.exemplo.test",
      EFI_CREDENTIAL_ENCRYPTION_KEY: "it-encryption-key-0123456789abcdef"
    };
    jest.restoreAllMocks();
    efi = fakeEfi();
    (gatewayModule.getEfiPixChargeGateway as jest.Mock).mockImplementation(async () => efi.gw);
    setGatewayWebhookQueueForTests({ add: jest.fn(async () => ({})) } as any);
    jest.spyOn(efiFinancialSource, "isEfiWebhookPipelineAsyncActive").mockReturnValue(true);
  });

  afterAll(async () => {
    process.env = originalEnv;
    setGatewayWebhookQueueForTests(null);
    await sequelize.close();
  });

  it("T-MT-07/T-MT-02: rotas novas exigem Super Admin (401 para não-super)", async () => {
    const t = tokenFor(tenantUser);
    const ev = await mkEvent();
    const calls = [
      request(app).get("/saas/finance/efi/webhook-events"),
      request(app).get("/saas/finance/efi/webhook-events/stats"),
      request(app).get(`/saas/finance/efi/webhook-events/${ev.id}`),
      request(app).post(`/saas/finance/efi/webhook-events/${ev.id}/reprocess`).send({ note: "tentativa" }),
      request(app).post(`/saas/finance/efi/webhook-events/${ev.id}/classify`).send({}),
      request(app).post("/saas/finance/efi/pix-sweep").send({ confirm: true }),
      request(app).post("/saas/finance/efi/config/homologation/homologate").send({ confirm: true }),
      request(app).post("/saas/finance/reconciliation/1/resolve").send({ note: "x" })
    ];
    for (const c of calls) expect((await auth(c, t)).status).toBe(401);
    expect((await request(app).get("/saas/finance/efi/webhook-events")).status).toBe(401);
  });

  it("RF3.19: lista com filtros (pendentes, status, txid, empresa), detalhe sanitizado e indicadores", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-1) });
    const txid = `shc${rnd(28)}`;
    const pending = await mkEvent({ status: "retry_scheduled", txid, companyId: company.id, lastError: "ERR_EFI_PIX_TIMEOUT" });
    await mkEvent({ status: "applied", companyId: company.id });
    const list = await auth(request(app).get("/saas/finance/efi/webhook-events").query({ status: "pending", companyId: company.id }));
    expect(list.status).toBe(200);
    expect(list.body.events.map((e: any) => e.id)).toEqual([pending.id]);
    const byTxid = await auth(request(app).get("/saas/finance/efi/webhook-events").query({ txid }));
    expect(byTxid.body.total).toBe(1);
    const detail = await auth(request(app).get(`/saas/finance/efi/webhook-events/${pending.id}`));
    expect(detail.body).toMatchObject({ id: pending.id, lastError: "ERR_EFI_PIX_TIMEOUT", attemptLog: [], adminActions: [] });
    expect(JSON.stringify(detail.body)).not.toContain("chaveHash");
    const stats = await auth(request(app).get("/saas/finance/efi/webhook-events/stats"));
    expect(stats.status).toBe(200);
    expect(stats.body.byStatus.retry_scheduled).toBeGreaterThanOrEqual(1);
    expect(stats.body).toHaveProperty("oldestPendingAgeSec");
    expect(stats.body).toHaveProperty("eventsWithoutJob");
  });

  it("T-ASY-18/T-REC-03: reprocessar exige nota, só nos status de R-30, auditado; negado para applied/replay e sem pipeline", async () => {
    const ev = await mkEvent({ status: "failed_exhausted", attempts: 8 });
    const noNote = await auth(request(app).post(`/saas/finance/efi/webhook-events/${ev.id}/reprocess`).send({}));
    expect(noNote.status).toBe(400);
    const ok = await auth(
      request(app).post(`/saas/finance/efi/webhook-events/${ev.id}/reprocess`).send({ note: "Efí normalizada" })
    );
    expect(ok.status).toBe(200);
    await ev.reload();
    expect(ev).toMatchObject({ status: "received", attempts: 0 });
    expect(ev.adminActions).toEqual([
      expect.objectContaining({ action: "reprocess", fromStatus: "failed_exhausted", note: "Efí normalizada", actorUserId: superUser.id })
    ]);
    const audit = await PlatformEfiConfigAudit.findOne({ where: { action: "webhook_event_reprocess" }, order: [["id", "DESC"]] });
    expect(JSON.parse(audit!.diffSummary!)).toMatchObject({ webhookEventId: ev.id, note: "Efí normalizada" });
    expect(audit!.actorUserId).toBe(superUser.id);
    for (const status of ["applied", "replay", "processing"]) {
      const other = await mkEvent({ status });
      const denied = await auth(
        request(app).post(`/saas/finance/efi/webhook-events/${other.id}/reprocess`).send({ note: "não deve" })
      );
      expect(denied.status).toBe(409);
    }
    (efiFinancialSource.isEfiWebhookPipelineAsyncActive as jest.Mock).mockReturnValue(false);
    const inactive = await mkEvent({ status: "unlinked" });
    const r = await auth(request(app).post(`/saas/finance/efi/webhook-events/${inactive.id}/reprocess`).send({ note: "sem worker" }));
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("ERR_EFI_WEBHOOK_PIPELINE_INACTIVE");
  });

  it("T-REC-10: converter unlinked em conciliação / marcar não é SaaS — nota, auditoria, evidência preservada", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-1) });
    const invoice = await createOpenInvoice(company.id);
    const a = await mkEvent();
    const b = await mkEvent();
    const noNote = await auth(request(app).post(`/saas/finance/efi/webhook-events/${a.id}/classify`).send({ action: "mark_not_saas" }));
    expect(noNote.status).toBe(400);
    const conv = await auth(
      request(app)
        .post(`/saas/finance/efi/webhook-events/${a.id}/classify`)
        .send({ action: "convert_to_reconciliation", note: "cliente pagou pela chave", companyId: company.id, invoiceId: invoice.id })
    );
    expect(conv.status).toBe(200);
    const item = await SaaSReconciliationItem.findByPk(conv.body.reconciliationItemId);
    expect(item).toMatchObject({ companyId: company.id, invoiceId: invoice.id, kind: "gateway_pix_unlinked" });
    expect((await a.reload()).status).toBe("reconciliation");
    expect(a.endToEndId).toBeTruthy();
    // Reprocessado de volta a unlinked e convertido de novo: mesmo item (idempotente por eventKey).
    await a.update({ status: "unlinked" });
    const conv2 = await auth(
      request(app)
        .post(`/saas/finance/efi/webhook-events/${a.id}/classify`)
        .send({ action: "convert_to_reconciliation", note: "segunda conversão", companyId: company.id })
    );
    expect(conv2.body.reconciliationItemId).toBe(item!.id);
    const c = await mkEvent();
    const badCompany = await auth(
      request(app)
        .post(`/saas/finance/efi/webhook-events/${c.id}/classify`)
        .send({ action: "convert_to_reconciliation", note: "empresa errada", companyId: 999999999 })
    );
    expect(badCompany.status).toBe(400);
    const mark = await auth(
      request(app).post(`/saas/finance/efi/webhook-events/${b.id}/classify`).send({ action: "mark_not_saas", note: "transferência pessoal" })
    );
    expect(mark.status).toBe(200);
    expect((await b.reload()).status).toBe("ignored_not_saas");
    const again = await auth(
      request(app).post(`/saas/finance/efi/webhook-events/${b.id}/classify`).send({ action: "mark_not_saas", note: "repetido" })
    );
    expect(again.status).toBe(409);
    expect(await PlatformEfiConfigAudit.count({ where: { action: "webhook_event_classify" } })).toBeGreaterThanOrEqual(2);
  });

  describe("conciliação", () => {
    async function openItem(companyId: number, message = "mensagem original") {
      return SaaSReconciliationItem.create({ companyId, kind: "gateway_pix_amount_mismatch", status: "pending", message } as any);
    }

    it("T-REC-01/T-REC-02/T-REC-08: nota obrigatória; ator + ledger + mensagem preservada; 2ª resolução 409", async () => {
      const company = await createCompany({ dueDate: daysFromToday(-1) });
      const item = await openItem(company.id);
      expect((await auth(request(app).post(`/saas/finance/reconciliation/${item.id}/resolve`).send({}))).status).toBe(400);
      const [r1, r2] = await Promise.all([
        auth(request(app).post(`/saas/finance/reconciliation/${item.id}/resolve`).send({ note: "estornado no banco" })),
        auth(request(app).post(`/saas/finance/reconciliation/${item.id}/resolve`).send({ note: "concorrente" }))
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      await item.reload();
      expect(item.status).toBe("resolved");
      expect(item.message).toBe("mensagem original");
      expect((item.metadata as any).resolution).toMatchObject({ actorUserId: superUser.id });
      const events = await SaaSFinancialEvent.findAll({ where: { eventType: "reconciliation_resolved", companyId: company.id } });
      expect(events).toHaveLength(1);
      expect(events[0].actorUserId).toBe(superUser.id);
    });

    it("T-REC-07/T-REC-09/T-MT-05: fila global só não resolvidos, paginada sem omitir; por empresa isolada", async () => {
      const company = await createCompany({ dueDate: daysFromToday(-1) });
      const other = await createCompany({ dueDate: daysFromToday(-1) });
      for (let i = 0; i < 105; i += 1) await openItem(company.id, `item ${i}`);
      const resolved = await openItem(company.id);
      await resolved.update({ status: "resolved" });
      await openItem(other.id);
      const p1 = await auth(request(app).get("/saas/finance/reconciliation").query({ companyId: company.id }));
      const p2 = await auth(request(app).get("/saas/finance/reconciliation").query({ companyId: company.id, page: 2 }));
      expect(p1.body).toMatchObject({ total: 105, limit: 100, hasMore: true });
      expect(p1.body.items).toHaveLength(100);
      expect(p2.body.items).toHaveLength(5);
      const ids = new Set([...p1.body.items, ...p2.body.items].map((i: any) => i.id));
      expect(ids.size).toBe(105);
      expect(ids.has(resolved.id)).toBe(false);
      const otherItems = await listCompanyReconciliation(other.id);
      expect(otherItems.every(i => i.companyId === other.id)).toBe(true);
    });
  });

  describe("varredura Pix (D-P10)", () => {
    it("T-REC-04: gate desligado → 403 e nada consultado na Efí", async () => {
      process.env.EFI_PIX_RECONCILIATION_SWEEP_ENABLED = "true";
      const r = await auth(request(app).post("/saas/finance/efi/pix-sweep").send({ confirm: true }));
      expect(r.status).toBe(403);
      expect(efi.gw.getCharge).not.toHaveBeenCalled();
    });

    it("T-REC-05/T-REC-06/P-B32-06: CONCLUIDA sem pagamento local → item, sem baixa; repetir não duplica", async () => {
      jest.spyOn(efiFinancialSource, "isEfiPixReconciliationSweepActive").mockReturnValue(true);
      const company = await createCompany({ dueDate: daysFromToday(-1) });
      const invoice = await createOpenInvoice(company.id);
      const txid = `shc${rnd(28)}`;
      await SaaSPaymentAttempt.create({
        companyId: company.id,
        invoiceId: invoice.id,
        method: "pix",
        status: "pending",
        externalTxid: txid,
        amount: 100
      } as any);
      efi.charges.set(txid, { txid, status: "CONCLUIDA", valor: { original: "100.00" }, pix: [{ endToEndId: "E1" }] });
      const r1 = await auth(request(app).post("/saas/finance/efi/pix-sweep").send({ confirm: true, days: 1 }));
      expect(r1.status).toBe(200);
      expect(r1.body.itemsCreated).toBeGreaterThanOrEqual(1);
      const r2 = await auth(request(app).post("/saas/finance/efi/pix-sweep").send({ confirm: true, days: 1 }));
      expect(r2.body.itemsCreated).toBe(0);
      expect(await SaaSReconciliationItem.count({ where: { kind: "pix_sweep_concluded_without_payment", invoiceId: invoice.id } })).toBe(1);
      expect((await invoice.reload()).status).toBe("open");
      expect(await PlatformEfiConfigAudit.count({ where: { action: "pix_sweep" } })).toBeGreaterThanOrEqual(2);
    });
  });

  describe("cadastro do webhook (T-ACT-08)", () => {
    it("v2 + legacy → formato atual (token); v2 + async → formato novo (whToken + ignorar=)", async () => {
      jest.spyOn(efiFinancialSource, "isEfiPixChargeV2Active").mockReturnValue(true);
      (efiFinancialSource.isEfiWebhookPipelineAsyncActive as jest.Mock).mockReturnValue(false);
      const legacy = await registerEfiWebhookForAdmin({ actorUserId: superUser.id, confirm: true });
      expect(efi.hooks.webhookUrl).toBe(`https://api.exemplo.test/subscription/webhook?token=${SECRET}`);
      expect(legacy.urlFormat).toBe("token_legacy");
      (efiFinancialSource.isEfiWebhookPipelineAsyncActive as jest.Mock).mockReturnValue(true);
      const v2 = await registerEfiWebhookForAdmin({ actorUserId: superUser.id, confirm: true });
      expect(efi.hooks.webhookUrl).toBe(`https://api.exemplo.test/subscription/webhook?whToken=${SECRET}&ignorar=`);
      expect(v2).toMatchObject({ urlFormat: "whToken_ignorar", conferred: true });
      expect(JSON.stringify(v2)).not.toContain(SECRET);
    });
  });

  describe("homologação (D-P17)", () => {
    async function validSlot(slot: "homologation" | "production") {
      const values = {
        slot,
        efiEnvironment: slot === "production" ? "production" : "sandbox",
        status: "configured",
        clientIdEncrypted: encryptEfiSecret("Client_Id_it"),
        clientSecretEncrypted: encryptEfiSecret("Client_Secret_it"),
        clientIdMasked: "****t_it",
        pixKeyEncrypted: encryptEfiSecret(PIX_KEY),
        pixKeyMasked: "****test",
        webhookSecretEncrypted: encryptEfiSecret(SECRET),
        webhookSecretConfigured: true,
        certificateEncrypted: encryptEfiSecret("p12-fake"),
        certificateFingerprint: "fp-it",
        adminEnabled: true,
        activatedAt: new Date(Date.now() - 60000),
        lastAuthTestOk: true
      } as any;
      const existing = await PlatformEfiConfig.findOne({ where: { slot } });
      const row = existing ? await existing.update(values) : await PlatformEfiConfig.create(values);
      const fingerprint = computeEfiConfigFingerprint(row);
      await PlatformEfiConfigAudit.create({
        configId: row.id,
        slot,
        action: "activate",
        diffSummary: JSON.stringify({ pixOAuthValidated: true, configFingerprint: fingerprint, efiEnvironment: row.efiEnvironment })
      } as any);
      return { row, fingerprint };
    }
    const build = (over: Partial<appBuildInfo.AppBuildInfo> = {}) =>
      jest.spyOn(appBuildInfo, "getAppBuildInfo").mockReturnValue({
        commit: COMMIT,
        source: "build_info",
        dirty: false,
        builtAt: null,
        ...over
      });
    const homologate = (slot: string, body: Record<string, unknown>) =>
      auth(request(app).post(`/saas/finance/efi/config/${slot}/homologate`).send(body));

    it("T-HOM-03: TESTE sem evidência → 400; com evento applied + pagamento + renovação do slot → aceito", async () => {
      build();
      const { row, fingerprint } = await validSlot("homologation");
      const invalidate = jest.spyOn(efiRuntimeCredentials, "invalidateEfiRuntimeCredentialsCache");
      expect((await homologate("homologation", { confirm: true, evidence: {} })).status).toBe(400);
      const company = await createCompany({ dueDate: daysFromToday(-3) });
      const invoice = await createOpenInvoice(company.id);
      const txid = `shc${rnd(28)}`;
      const r = await confirmGatewayPayment({ invoiceId: invoice.id, amount: 100, method: "pix", externalTxid: txid, gatewayProvider: "efi" });
      const renewal = await SaaSSubscriptionRenewal.findOne({ where: { paymentId: r.payment!.id } });
      const event = await mkEvent({
        status: "applied",
        txid,
        paymentId: r.payment!.id,
        result: { currentSource: "legacy_env", configFingerprint: null, efiEnvironment: "sandbox" }
      });
      const evidence = { webhookEventId: event.id, paymentId: r.payment!.id, renewalId: renewal!.id };
      // Evento processado com a fonte env não é evidência do slot.
      expect((await homologate("homologation", { confirm: true, evidence })).status).toBe(400);
      await event.update({ result: { currentSource: "database", configFingerprint: fingerprint, efiEnvironment: "sandbox" } });
      expect((await homologate("homologation", { confirm: false, evidence })).status).toBe(400);
      const ok = await homologate("homologation", { confirm: true, evidence });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ homologated: true, configFingerprint: fingerprint, commit: COMMIT, efiEnvironment: "sandbox" });
      expect(invalidate).toHaveBeenCalled();
      const rec = await findEfiHomologationForConfig(row, fingerprint);
      expect(rec).toMatchObject({ commit: COMMIT });
      const audit = await PlatformEfiConfigAudit.findByPk(ok.body.auditId);
      expect(audit!.actorUserId).toBe(superUser.id);
      // Troca de segredo → fingerprint novo → homologação anterior não vale.
      await row.update({ webhookSecretEncrypted: encryptEfiSecret("outro-secret-com-mais-de-32-caracteres!!") });
      expect(await findEfiHomologationForConfig(row, computeEfiConfigFingerprint(row))).toBeNull();
    });

    it("P-B31-11: build sujo ou sem commit → recusado", async () => {
      await validSlot("homologation");
      build({ dirty: true });
      expect((await homologate("homologation", { confirm: true, evidence: {} })).body.error).toBe("ERR_EFI_HOMOLOGATE_DIRTY_BUILD");
      (appBuildInfo.getAppBuildInfo as jest.Mock).mockReturnValue({ commit: null, source: null, dirty: null, builtAt: null });
      expect((await homologate("homologation", { confirm: true, evidence: {} })).body.error).toBe("ERR_EFI_HOMOLOGATE_COMMIT_UNKNOWN");
    });

    it("T-HOM-04: PRODUÇÃO sem SaaSPayment: relatório TESTE do mesmo commit + webhook conferido + evento teste", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      build();
      await validSlot("production");
      const testEvent = await mkEvent({ eventKey: `teste:${rnd(40)}`, eventType: "teste", status: "ignored_not_saas" });
      const evidence = { testReportRef: "docs/FASE-8.3-B3-EFI/RELATORIO-HOMOLOGACAO.md", testReportCommit: COMMIT.slice(0, 7), testEventId: testEvent.id };
      // Sem webhook cadastrado na Efí → recusado.
      expect((await homologate("production", { confirm: true, evidence })).body.error).toBe("ERR_EFI_HOMOLOGATE_WEBHOOK_NOT_CONFERRED");
      efi.hooks.webhookUrl = buildSubscriptionWebhookUrlV2(SECRET);
      expect((await homologate("production", { confirm: true, evidence: { ...evidence, testReportCommit: "1234567" } })).body.error).toBe(
        "ERR_EFI_HOMOLOGATE_COMMIT_MISMATCH"
      );
      // Commit curto demais (casaria com qualquer build) é recusado.
      expect((await homologate("production", { confirm: true, evidence: { ...evidence, testReportCommit: COMMIT.slice(0, 1) } })).status).toBe(400);
      const missing = await homologate("production", { confirm: true, evidence: { testReportRef: evidence.testReportRef } });
      expect(missing.status).toBe(400);
      const before = await PlatformEfiConfigAudit.count({ where: { action: "homologate", slot: "production" } });
      const ok = await homologate("production", { confirm: true, evidence });
      expect(ok.status).toBe(200);
      expect(ok.body.evidence).toMatchObject({ testEventId: testEvent.id, webhookConferred: true });
      expect(JSON.stringify(ok.body)).not.toContain(SECRET);
      expect(await PlatformEfiConfigAudit.count({ where: { action: "homologate", slot: "production" } })).toBe(before + 1);
      // Teste do slot de outro runtime é recusado.
      expect((await homologate("homologation", { confirm: true, evidence })).status).toBe(403);
    });

    it("T-HOM-05: commit diferente do homologado → status avisa; integração não é desabilitada", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      const { row, fingerprint } = await validSlot("production");
      await PlatformEfiConfigAudit.create({
        configId: row.id,
        slot: "production",
        action: "homologate",
        diffSummary: JSON.stringify({ configFingerprint: fingerprint, efiEnvironment: "production", commit: "1111111" })
      } as any);
      process.env.EFI_CREDENTIALS_SOURCE = "database";
      // getAppBuildCommit lê o env (sem build-info.json no src).
      process.env.GIT_COMMIT = COMMIT;
      const status = await getEfiIntegrationStatus();
      expect(status.credentialsSource.database).toMatchObject({
        homologation: expect.objectContaining({ homologated: true, versionDiffers: true }),
        usable: true
      });
      expect(status.webhookPipeline).toMatchObject({ released: false, sweep: { released: false } });
    });
  });
});
