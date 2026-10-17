/**
 * Integração 8.4-F — Central de assinatura (C3), Linha do tempo (C4), Prévia de pagamento (C6)
 * e gateway após quitação manual/histórica. Postgres real; SDK Efí SEMPRE mockado.
 */
// Deve vir ANTES dos routers (express-async-errors só envolve layers criados após o patch).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import saasFinanceRoutes from "../routes/saasFinanceRoutes";
import subscriptionRoutes from "../routes/subScriptionRoutes";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  DOMAIN_DATE_RE,
  assertDisposableDatabase,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  domainDate,
  reloadCompany,
  today
} from "./helpers/fixtures";
import {
  addCompanyLog,
  codesOf,
  createLegacyInvoice,
  globalWriteSnapshot,
  optionalRequire,
  rawPayments,
  reconciliationItems,
  requireFeature,
  revenueOfInvoice,
  routerOf
} from "./helpers/f84f";

const mockPixDetailCharge = jest.fn();
jest.mock("gn-api-sdk-typescript", () => ({
  __esModule: true,
  default: () => ({ pixDetailCharge: (...args: unknown[]) => mockPixDetailCharge(...args) })
}));

const subscriptionCenterRoutes = optionalRequire("../../routes/saasSubscriptionRoutes");
const historicalRoutes = optionalRequire("../../routes/saasHistoricalReviewRoutes");
// Routers novos primeiro (rotas mais específicas, ex.: manual-payment/preview).
const app = buildApp(
  [routerOf(subscriptionCenterRoutes), routerOf(historicalRoutes), saasFinanceRoutes, subscriptionRoutes].filter(
    Boolean
  ) as any
);

describe("8.4-F — Assinatura: central, timeline, prévia de pagamento e gateway (Postgres real)", () => {
  let superToken: string;
  let superUserId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
    const host = await createCompany({ dueDate: daysFromToday(365) });
    const su = await createUser({ companyId: host.id, superUser: true });
    superUserId = su.id;
    superToken = tokenFor({ id: su.id, profile: "admin", companyId: host.id });
  });

  beforeEach(() => mockPixDetailCharge.mockReset());

  afterAll(async () => {
    await sequelize.close();
  });

  const get = (url: string) => request(app).get(url).set("Authorization", `Bearer ${superToken}`);
  const post = (url: string, body: Record<string, unknown>) =>
    request(app).post(url).set("Authorization", `Bearer ${superToken}`).send(body);

  // ───────────────────────────── C3 — Central de assinatura ─────────────────────────────
  describe("C3 — GET /saas/companies/:companyId/subscription", () => {
    it("ativa + vencida (dueDate Date do banco): status operacional ativa, assinatura vencida, daysLate correto", async () => {
      requireFeature(subscriptionCenterRoutes);
      const due = daysFromToday(-10);
      const company = await createCompany({ dueDate: due, status: true });
      await createOpenInvoice(company.id, { dueDate: due });
      const res = await get(`/saas/companies/${company.id}/subscription`);
      expect(res.status).toBe(200);
      expect(res.body.company).toMatchObject({ id: company.id });
      expect(res.body.currentDueDate).toBe(due);
      expect(res.body.status).toMatchObject({
        operational: "ativa",
        blockKind: "none",
        subscription: "vencida",
        financial: "vencido",
        daysLate: 10
      });
      expect(res.body.pendencies).toMatchObject({ openInvoices: 1, overdueInvoices: 1 });
      expect(Number(res.body.pendencies.openAmount)).toBe(100);
      // nextCycleDueDate = mesma regra da renovação (rota existente renewal-preview)
      const prev = await get(`/saas/companies/${company.id}/finance/renewal-preview`);
      expect(prev.status).toBe(200);
      expect(res.body.nextCycleDueDate).toBe(prev.body.newDueDate);
      expect(res.body.nextExpectedCharge).toMatchObject({ dueDate: due });
    });

    it("bloqueada manualmente em dia → bloqueada/manual, assinatura em_dia", async () => {
      requireFeature(subscriptionCenterRoutes);
      const due = daysFromToday(20);
      const company = await createCompany({ dueDate: due, status: false });
      await addCompanyLog(company.id, "block");
      const res = await get(`/saas/companies/${company.id}/subscription`);
      expect(res.status).toBe(200);
      expect(res.body.status).toMatchObject({
        operational: "bloqueada",
        blockKind: "manual",
        subscription: "em_dia",
        financial: "em_dia",
        daysUntilDue: 20
      });
    });

    it("sem vencimento → sem_vencimento em subscription e financial; currentDueDate null", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: null });
      const res = await get(`/saas/companies/${company.id}/subscription`);
      expect(res.status).toBe(200);
      expect(res.body.currentDueDate).toBeNull();
      expect(res.body.status).toMatchObject({ subscription: "sem_vencimento", financial: "sem_vencimento" });
      expect(res.body.lastConfirmedPayment).toBeNull();
    });

    it("último pagamento confirmado com data desconhecida (regularização histórica) → paidAt null, paidAtUnknown true", async () => {
      requireFeature(subscriptionCenterRoutes, historicalRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-40) });
      const inv = await createLegacyInvoice(company.id, {});
      const h = await post(`/saas/companies/${company.id}/finance/invoices/${inv.id}/historical-review`, {
        decision: "historical_payment",
        note: "Pagamento antigo sem data",
        confirmationSource: "planilha antiga",
        paidAtUnknown: true,
        amount: 100,
        method: "unknown"
      });
      expect({ s: h.status, e: h.body.error }).toEqual({ s: 201, e: undefined });
      const res = await get(`/saas/companies/${company.id}/subscription`);
      expect(res.status).toBe(200);
      expect(res.body.lastConfirmedPayment).toMatchObject({
        invoiceId: inv.id,
        paidAt: null,
        paidAtUnknown: true,
        source: "historical_payment"
      });
      expect(Number(res.body.lastConfirmedPayment.amount)).toBe(100);
    });

    it("isolamento: pendências não misturam empresas; empresa inexistente → 404", async () => {
      requireFeature(subscriptionCenterRoutes);
      const a = await createCompany({ dueDate: daysFromToday(5) });
      const b = await createCompany({ dueDate: daysFromToday(5) });
      await createOpenInvoice(b.id, { dueDate: daysFromToday(-3) });
      await createOpenInvoice(b.id, { dueDate: daysFromToday(-33) });
      const ra = await get(`/saas/companies/${a.id}/subscription`);
      expect(ra.status).toBe(200);
      expect(ra.body.pendencies).toMatchObject({ openInvoices: 0, overdueInvoices: 0 });
      expect(ra.body.nextExpectedCharge).toBeNull();
      const rb = await get(`/saas/companies/${b.id}/subscription`);
      expect(rb.body.pendencies.openInvoices).toBe(2);
      const r404 = await get(`/saas/companies/99999999/subscription`);
      expect(r404.status).toBe(404);
    });
  });

  // ───────────────────────────── C4 — Linha do tempo ─────────────────────────────
  describe("C4 — GET /saas/companies/:companyId/timeline", () => {
    const sortedDesc = (items: any[]) =>
      items.every((it, i) => i === 0 || new Date(items[i - 1].occurredAt).getTime() >= new Date(it.occurredAt).getTime());

    it("ordem cronológica (mais recente primeiro), fatura legada sem evento uma vez, renovação sem duplicar", async () => {
      requireFeature(subscriptionCenterRoutes);
      const due = daysFromToday(-10);
      const company = await createCompany({ dueDate: due, status: false });
      await addCompanyLog(company.id, "auto_block", `${daysFromToday(-5)}T10:00:00-03:00`);
      const legacy = await createOpenInvoice(company.id, { dueDate: due }); // sem evento invoice_created*
      // fatura criada pelo serviço (gera invoice_created_manual no ledger)
      const created = await post(`/saas/companies/${company.id}/finance/invoices`, {
        dueDate: daysFromToday(20),
        value: 100,
        competence: daysFromToday(20).slice(0, 7),
        reason: "Fatura do próximo ciclo"
      });
      expect(created.status).toBe(201);
      await registerManualPayment({
        invoiceId: legacy.id,
        companyId: company.id,
        actorUserId: superUserId,
        kind: "paid_offline",
        amount: 100,
        method: "transfer",
        paidAt: new Date(),
        reason: "Recebido por TED",
        renewSubscription: true
      } as any);

      const res = await get(`/saas/companies/${company.id}/timeline?limit=100`);
      expect(res.status).toBe(200);
      const items: any[] = res.body.items;
      expect(Array.isArray(items)).toBe(true);
      expect(sortedDesc(items)).toBe(true);
      // ids únicos
      expect(new Set(items.map(i => i.id)).size).toBe(items.length);
      // fatura legada (sem evento) aparece UMA vez como invoice_created
      const legacyCreated = items.filter(i => i.invoiceId === legacy.id && i.kind === "invoice_created");
      expect(legacyCreated).toHaveLength(1);
      expect(legacyCreated[0].source).toBe("invoice");
      // fatura com evento no ledger não aparece duplicada pela fonte "invoice"
      const newInvId = created.body.invoice.id;
      const newCreated = items.filter(i => i.invoiceId === newInvId && i.kind === "invoice_created");
      expect(newCreated).toHaveLength(1);
      expect(newCreated[0].source).toBe("ledger");
      // renovação por pagamento: uma única entrada (ledger x CompanyLog renew_payment_confirmed)
      const renewals = items.filter(i => String(i.kind).startsWith("renewal_"));
      expect(renewals.map(r => ({ kind: r.kind, source: r.source }))).toEqual([{ kind: "renewal_payment", source: expect.any(String) }]);
      expect(items.filter(i => i.kind === "payment_manual")).toHaveLength(1);
      expect(items.some(i => i.kind === "block_auto" && i.source === "company_log")).toBe(true);
      // amount numérico ou null
      expect(items.every(i => i.amount === null || typeof i.amount === "number")).toBe(true);
    });

    it("cursor before: páginas sem sobreposição e cobrindo a lista completa", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-3) });
      for (let d = 9; d >= 1; d -= 2) {
        await addCompanyLog(company.id, d % 4 === 1 ? "block" : "unblock", `${daysFromToday(-d)}T09:00:00-03:00`);
      }
      await createOpenInvoice(company.id, { dueDate: daysFromToday(-3) });
      const full = await get(`/saas/companies/${company.id}/timeline?limit=100`);
      expect(full.status).toBe(200);
      const all: string[] = full.body.items.map((i: any) => i.id);
      expect(all.length).toBeGreaterThanOrEqual(6);

      const seen: string[] = [];
      let before: string | null = null;
      for (let guard = 0; guard < 20; guard += 1) {
        const page: any = await get(
          `/saas/companies/${company.id}/timeline?limit=2${before ? `&before=${encodeURIComponent(before)}` : ""}`
        );
        expect(page.status).toBe(200);
        expect(page.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.body.items.map((i: any) => i.id));
        before = page.body.nextBefore;
        if (!before) break;
      }
      expect(new Set(seen).size).toBe(seen.length); // sem duplicar entre páginas
      expect(seen).toEqual(all); // mesma ordem, nada perdido
    });

    it("isolamento: a timeline de uma empresa não traz itens de outra; inexistente → 404", async () => {
      requireFeature(subscriptionCenterRoutes);
      const a = await createCompany({ dueDate: daysFromToday(5) });
      const b = await createCompany({ dueDate: daysFromToday(5) });
      const invB = await createOpenInvoice(b.id, { dueDate: daysFromToday(-1) });
      await addCompanyLog(b.id, "block");
      const ra = await get(`/saas/companies/${a.id}/timeline`);
      expect(ra.status).toBe(200);
      expect(ra.body.items.filter((i: any) => i.invoiceId === invB.id)).toEqual([]);
      expect(ra.body.items.filter((i: any) => i.kind === "block_manual")).toEqual([]);
      const r404 = await get(`/saas/companies/99999999/timeline`);
      expect(r404.status).toBe(404);
    });
  });

  // ───────────────────────────── C6 — Prévia de pagamento ─────────────────────────────
  describe("C6 — POST /saas/companies/:companyId/finance/manual-payment/preview", () => {
    const body = (invoiceId: number, over: Record<string, unknown> = {}) => ({
      invoiceId,
      kind: "paid_offline",
      amount: 100,
      method: "transfer",
      paidAt: today(),
      reason: "Recebido por transferência",
      ...over
    });

    it("prévia não escreve nada", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-10), status: false });
      const inv = await createOpenInvoice(company.id, { dueDate: daysFromToday(-10) });
      const snap = await globalWriteSnapshot();
      const p = await post(`/saas/companies/${company.id}/finance/manual-payment/preview`, body(inv.id));
      expect(p.status).toBe(200);
      expect(await globalWriteSnapshot()).toEqual(snap);
    });

    it.each([
      ["bloqueada financeiramente e vencida (renova + desbloqueia)", -10, false, "auto_block", -10],
      ["período já coberto (vencimento atual à frente da fatura)", 60, true, null, -10],
      ["ativa e vencida, ciclos pulados", -75, true, null, -75]
    ])("prévia prevê exatamente o que a execução produz: %s", async (_l, dueOff, status, log, invOff) => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(dueOff as number), status: status as boolean });
      if (log) await addCompanyLog(company.id, log as string);
      const inv = await createOpenInvoice(company.id, { dueDate: daysFromToday(invOff as number) });
      const p = await post(`/saas/companies/${company.id}/finance/manual-payment/preview`, body(inv.id));
      expect(p.status).toBe(200);
      expect(p.body.valid).toBe(true);
      expect(p.body.previousDueDate).toBe(daysFromToday(dueOff as number));
      expect(p.body.expectedCurrentDueDate).toBe(daysFromToday(dueOff as number));
      expect(p.body.invoiceStatusAfter).toBe("paid");
      expect(p.body.revenueEffect).toBe("revenue");

      const exec = await post(
        `/saas/companies/${company.id}/finance/manual-payment`,
        body(inv.id, { expectedCurrentDueDate: p.body.expectedCurrentDueDate })
      );
      expect({ s: exec.status, e: exec.body.error }).toEqual({ s: 201, e: undefined });
      const after = await reloadCompany(company.id);
      expect({
        willRenew: exec.body.renewed,
        renewalSkippedReason: exec.body.renewalSkippedReason ?? null,
        newDueDate: exec.body.renewed ? domainDate(after.dueDate) : null,
        willUnblock: (status as boolean) === false && after.status === true
      }).toEqual({
        willRenew: p.body.willRenew,
        renewalSkippedReason: p.body.renewalSkippedReason ?? null,
        newDueDate: p.body.willRenew ? p.body.newDueDate : null,
        willUnblock: p.body.willUnblock
      });
      if (p.body.willRenew) expect(p.body.newDueDate).toMatch(DOMAIN_DATE_RE);
    });

    it("vencimento muda entre prévia e execução → 409 ERR_PAYMENT_STATE_CHANGED, sem pagamento", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-10) });
      const inv = await createOpenInvoice(company.id, { dueDate: daysFromToday(-10) });
      const p = await post(`/saas/companies/${company.id}/finance/manual-payment/preview`, body(inv.id));
      expect(p.status).toBe(200);
      // outro operador altera o vencimento
      await Company.update({ dueDate: `${daysFromToday(15)}T00:00:00-03:00` } as any, { where: { id: company.id } });
      const exec = await post(
        `/saas/companies/${company.id}/finance/manual-payment`,
        body(inv.id, { expectedCurrentDueDate: p.body.expectedCurrentDueDate })
      );
      expect({ s: exec.status, e: exec.body.error }).toEqual({ s: 409, e: "ERR_PAYMENT_STATE_CHANGED" });
      expect(await rawPayments(inv.id)).toHaveLength(0);
      expect((await Invoices.findByPk(inv.id))?.status).toBe("open");
    });

    it("bloqueio manual → willUnblock false, blockKind manual, alerta; execução mantém bloqueada", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-10), status: false });
      await addCompanyLog(company.id, "block");
      const inv = await createOpenInvoice(company.id, { dueDate: daysFromToday(-10) });
      const p = await post(`/saas/companies/${company.id}/finance/manual-payment/preview`, body(inv.id));
      expect(p.status).toBe(200);
      expect(p.body).toMatchObject({ willUnblock: false, blockKind: "manual" });
      expect(codesOf(p.body.alerts)).toContain("MANUAL_BLOCK_KEEPS_BLOCKED");
      const exec = await post(
        `/saas/companies/${company.id}/finance/manual-payment`,
        body(inv.id, { expectedCurrentDueDate: p.body.expectedCurrentDueDate })
      );
      expect(exec.status).toBe(201);
      expect((await reloadCompany(company.id)).status).toBe(false);
    });

    it("fatura candidata à regularização histórica → alerta HISTORICAL_CANDIDATE", async () => {
      requireFeature(subscriptionCenterRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-40) });
      const inv = await createLegacyInvoice(company.id, {});
      const p = await post(`/saas/companies/${company.id}/finance/manual-payment/preview`, body(inv.id));
      expect(p.status).toBe(200);
      expect(codesOf(p.body.alerts)).toContain("HISTORICAL_CANDIDATE");
    });

    it("isolamento: fatura de outra empresa → 404", async () => {
      requireFeature(subscriptionCenterRoutes);
      const a = await createCompany({ dueDate: daysFromToday(-10) });
      const b = await createCompany({ dueDate: daysFromToday(-10) });
      const invB = await createOpenInvoice(b.id, { dueDate: daysFromToday(-10) });
      const p = await post(`/saas/companies/${a.id}/finance/manual-payment/preview`, body(invB.id));
      expect(p.status).toBe(404);
    });

    it("renewal-preview (rota existente) inclui willUnblock, blockKind e alerts (compatível)", async () => {
      const company = await createCompany({ dueDate: daysFromToday(-10), status: false });
      await addCompanyLog(company.id, "block");
      const r = await get(`/saas/companies/${company.id}/finance/renewal-preview`);
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty("newDueDate");
      expect(r.body).toHaveProperty("willUnblock");
      expect(r.body.blockKind).toBe("manual");
      expect(Array.isArray(r.body.alerts)).toBe(true);
    });
  });

  // ─────────────── Gateway após quitação manual/histórica (txid novo) ───────────────
  describe("Gateway após quitação manual/histórica", () => {
    it("baixa manual → confirmação gateway com txid NOVO: sem renovação, sem receita duplicada, conciliação idempotente", async () => {
      const due = daysFromToday(-3);
      const company = await createCompany({ dueDate: due });
      const inv = await createOpenInvoice(company.id, { dueDate: due, externalTxid: `itG${Date.now()}a` });
      await registerManualPayment({
        invoiceId: inv.id,
        companyId: company.id,
        actorUserId: superUserId,
        kind: "paid_offline",
        amount: 100,
        method: "transfer",
        paidAt: new Date(),
        reason: "Recebido por TED",
        renewSubscription: true
      } as any);
      const dueAfter = domainDate((await reloadCompany(company.id)).dueDate);
      const renewalsBefore = (await countState(company.id)).renewals;

      const newTxid = `itG${Date.now()}NEW`;
      const input = { invoiceId: inv.id, amount: 100, method: "pix" as const, externalTxid: newTxid, gatewayProvider: "efi" };
      const r1: any = await confirmGatewayPayment(input);
      const r2: any = await confirmGatewayPayment(input);
      expect(r1.renewed).toBe(false);
      expect(r2.renewed).toBe(false);
      expect((await countState(company.id)).renewals).toBe(renewalsBefore);
      expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(dueAfter);
      expect(await revenueOfInvoice(inv.id)).toBe(100);
      expect(await reconciliationItems(inv.id, "gateway_payment_on_settled_invoice")).toHaveLength(1);
    });

    it("regularização histórica → webhook Pix com txid NOVO (reenviado): sem renovação, sem receita duplicada, 1 item de conciliação", async () => {
      requireFeature(historicalRoutes);
      const company = await createCompany({ dueDate: daysFromToday(-40) });
      const inv = await createLegacyInvoice(company.id, {});
      const h = await post(`/saas/companies/${company.id}/finance/invoices/${inv.id}/historical-review`, {
        decision: "historical_payment",
        note: "Pago no passado",
        confirmationSource: "extrato",
        paidAt: "2026-08-01",
        amount: 100,
        method: "pix"
      });
      expect({ s: h.status, e: h.body.error }).toEqual({ s: 201, e: undefined });
      const stateBefore = await countState(company.id);
      const dueBefore = domainDate((await reloadCompany(company.id)).dueDate);

      const txid = `itG${Date.now()}H`;
      mockPixDetailCharge.mockResolvedValue({
        status: "CONCLUIDA",
        solicitacaoPagador: `#Fatura:${inv.id}`,
        valor: { original: "100.00" }
      });
      const w1 = await request(app).post("/subscription/webhook").send({ pix: [{ txid }] });
      const w2 = await request(app).post("/subscription/webhook").send({ pix: [{ txid }] });
      expect([w1.status, w2.status]).toEqual([200, 200]);
      expect((await countState(company.id)).renewals).toBe(stateBefore.renewals);
      expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(dueBefore);
      expect(await revenueOfInvoice(inv.id)).toBe(100);
      expect(await reconciliationItems(inv.id, "gateway_payment_on_settled_invoice")).toHaveLength(1);
      expect((await rawPayments(inv.id)).filter(p => p.countsAsRevenue)).toHaveLength(1);
    });
  });
});
