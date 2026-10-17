/**
 * Integração 8.4-F — Regularização histórica (contrato C5), Postgres real.
 * Routers montados diretamente (ainda não registrados em routes/index.ts).
 */
// Deve vir ANTES dos routers (express-async-errors só envolve layers criados após o patch).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import SaaSPayment from "../models/SaaSPayment";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  domainDate,
  reloadCompany
} from "./helpers/fixtures";
import {
  codesOf,
  createLegacyInvoice,
  globalWriteSnapshot,
  historicalReviewCount,
  optionalRequire,
  rawPayments,
  requireFeature,
  revenueOfInvoice,
  routerOf
} from "./helpers/f84f";

const historicalRoutes = optionalRequire("../../routes/saasHistoricalReviewRoutes");
const app = buildApp([routerOf(historicalRoutes)].filter(Boolean) as any);

const OLD_CREATED_AT = "2026-09-01T12:00:00-03:00"; // antes da referência 2026-10-17

describe("8.4-F — Regularização histórica (Postgres real)", () => {
  let superToken: string;
  let superUserId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    const su = await createUser({ companyId: host.id, superUser: true });
    superUserId = su.id;
    superToken = tokenFor({ id: su.id, profile: "admin", companyId: host.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const base = (companyId: number, invoiceId: number) =>
    `/saas/companies/${companyId}/finance/invoices/${invoiceId}/historical-review`;
  const post = (url: string, body: Record<string, unknown>) =>
    request(app).post(url).set("Authorization", `Bearer ${superToken}`).send(body);

  const paymentBody = (over: Record<string, unknown> = {}) => ({
    decision: "historical_payment",
    note: "Pagamento antigo confirmado no extrato",
    confirmationSource: "extrato bancário",
    paidAt: "2026-08-10",
    amount: 100,
    method: "transfer",
    ...over
  });

  /** Estado que NÃO pode mudar com a regularização (sem renovação). */
  const subscriptionState = async (companyId: number) => {
    const c = await reloadCompany(companyId);
    const s = await countState(companyId);
    return { dueDate: domainDate(c.dueDate), status: c.status, renewals: s.renewals };
  };

  it("candidata (legada, criada antes da referência) → historical_payment com data real: pago, receita, SEM renovação", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40), status: false });
    const inv = await createLegacyInvoice(company.id, { createdAt: OLD_CREATED_AT, cycleKey: "2026-08", dueDate: "2026-08-05" });
    const before = await subscriptionState(company.id);

    const res = await post(base(company.id, inv.id), paymentBody());
    expect({ status: res.status, error: res.body?.error }).toEqual({ status: 201, error: undefined });
    expect(res.body.review).toBeTruthy();
    expect(res.body.payment).toBeTruthy();

    expect((await Invoices.findByPk(inv.id))?.status).toBe("paid");
    const pays = await rawPayments(inv.id);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ source: "historical_payment", countsAsRevenue: true, amount: 100 });
    expect(pays[0].paidAt).not.toBeNull();
    expect(domainDate(pays[0].paidAt)).toBe("2026-08-10");
    expect(await revenueOfInvoice(inv.id)).toBe(100);
    expect(await subscriptionState(company.id)).toEqual(before);
    expect(await historicalReviewCount(inv.id)).toBe(1);
  });

  it("historical_payment com data desconhecida → SaaSPayments.paidAt NULL no banco (sem data inventada), metadata.paidAtUnknown", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, { legacyUnknown: true, cycleKey: "2026-07" });
    const before = await subscriptionState(company.id);

    const body = paymentBody({ paidAt: undefined, paidAtUnknown: true });
    const res = await post(base(company.id, inv.id), body);
    expect({ status: res.status, error: res.body?.error }).toEqual({ status: 201, error: undefined });
    const pays = await rawPayments(inv.id);
    expect(pays).toHaveLength(1);
    expect(pays[0].paidAt).toBeNull();
    expect(pays[0].metadata?.paidAtUnknown).toBe(true);
    expect(pays[0].countsAsRevenue).toBe(true);
    expect(await subscriptionState(company.id)).toEqual(before);
  });

  it("historical_payment: valor diferente da fatura → 400 (preview e apply com o mesmo código), sem escrita", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const snap = await globalWriteSnapshot();

    const prevLow = await post(`${base(company.id, inv.id)}/preview`, paymentBody({ amount: 90 }));
    const applyLow = await post(base(company.id, inv.id), paymentBody({ amount: 90 }));
    const prevHigh = await post(`${base(company.id, inv.id)}/preview`, paymentBody({ amount: 110 }));
    const applyHigh = await post(base(company.id, inv.id), paymentBody({ amount: 110 }));

    expect(prevLow.status).toBe(200);
    expect(prevLow.body.valid).toBe(false);
    expect(codesOf(prevLow.body.errors)).toContain("ERR_PAYMENT_AMOUNT_INSUFFICIENT");
    expect({ s: applyLow.status, e: applyLow.body.error }).toEqual({ s: 400, e: "ERR_PAYMENT_AMOUNT_INSUFFICIENT" });
    expect(codesOf(prevHigh.body.errors)).toContain("ERR_PAYMENT_AMOUNT_EXCEEDS");
    expect({ s: applyHigh.status, e: applyHigh.body.error }).toEqual({ s: 400, e: "ERR_PAYMENT_AMOUNT_EXCEEDS" });
    expect(await globalWriteSnapshot()).toEqual(snap);
  });

  it("preview = apply: mesmas validações (paidAt/paidAtUnknown, fonte, nota) e preview não escreve", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});

    const cases: Array<[Record<string, unknown>, string]> = [
      [paymentBody({ paidAt: undefined }), "ERR_HISTORICAL_PAID_AT_REQUIRED"],
      [paymentBody({ paidAt: "2026-08-10", paidAtUnknown: true }), "ERR_HISTORICAL_PAID_AT_REQUIRED"],
      [paymentBody({ confirmationSource: undefined }), "ERR_HISTORICAL_SOURCE_REQUIRED"],
      [{ decision: "historical_courtesy", note: "Cortesia antiga acordada" }, "ERR_HISTORICAL_SOURCE_REQUIRED"]
    ];
    const snap = await globalWriteSnapshot();
    const mismatches: unknown[] = [];
    for (const [body, code] of cases) {
      const p = await post(`${base(company.id, inv.id)}/preview`, body);
      const a = await post(base(company.id, inv.id), body);
      const ok =
        p.status === 200 && p.body.valid === false && codesOf(p.body.errors).includes(code) &&
        a.status === 400 && a.body.error === code;
      if (!ok) mismatches.push({ body, code, preview: { s: p.status, b: p.body }, apply: { s: a.status, b: a.body } });
    }
    // nota curta (< 5): ambos recusam
    const pn = await post(`${base(company.id, inv.id)}/preview`, paymentBody({ note: "ok" }));
    const an = await post(base(company.id, inv.id), paymentBody({ note: "ok" }));
    if (!(an.status === 400 && (pn.status === 400 || pn.body.valid === false))) {
      mismatches.push({ case: "note<5", preview: { s: pn.status, b: pn.body }, apply: { s: an.status, b: an.body } });
    }
    expect(mismatches).toEqual([]);
    expect(await globalWriteSnapshot()).toEqual(snap);

    // preview válido: previsão coerente e nenhuma escrita
    const ok = await post(`${base(company.id, inv.id)}/preview`, paymentBody());
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      valid: true,
      decision: "historical_payment",
      revenueEffect: "revenue",
      invoiceStatusAfter: "paid",
      willRenew: false,
      payment: { amount: 100, paidAt: "2026-08-10", paidAtUnknown: false }
    });
    expect(await globalWriteSnapshot()).toEqual(snap);
    expect(await historicalReviewCount(inv.id)).toBe(0);
  });

  it("não candidata (fatura nova do ciclo, criada após a referência) → 409 ERR_HISTORICAL_NOT_ELIGIBLE (preview e apply)", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-5) });
    const inv = await createOpenInvoice(company.id, { dueDate: daysFromToday(-5) }); // cycleKey preenchido, createdAt = agora
    const snap = await globalWriteSnapshot();
    const p = await post(`${base(company.id, inv.id)}/preview`, paymentBody());
    const a = await post(base(company.id, inv.id), paymentBody());
    const previewRefused =
      (p.status === 409 && p.body.error === "ERR_HISTORICAL_NOT_ELIGIBLE") ||
      (p.status === 200 && p.body.valid === false && codesOf(p.body.errors).includes("ERR_HISTORICAL_NOT_ELIGIBLE"));
    expect({ previewRefused, preview: p.body }).toMatchObject({ previewRefused: true });
    expect({ s: a.status, e: a.body.error }).toEqual({ s: 409, e: "ERR_HISTORICAL_NOT_ELIGIBLE" });
    expect(await globalWriteSnapshot()).toEqual(snap);
  });

  it("historical_courtesy → fatura paga, SEM receita, sem renovação", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, { createdAt: OLD_CREATED_AT, cycleKey: "2026-08" });
    const before = await subscriptionState(company.id);
    const res = await post(base(company.id, inv.id), {
      decision: "historical_courtesy",
      note: "Cortesia concedida pelo comercial",
      confirmationSource: "e-mail do comercial"
    });
    expect({ status: res.status, error: res.body?.error }).toEqual({ status: 201, error: undefined });
    expect((await Invoices.findByPk(inv.id))?.status).toBe("paid");
    const pays = await rawPayments(inv.id);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ source: "historical_courtesy", countsAsRevenue: false });
    expect(await revenueOfInvoice(inv.id)).toBe(0);
    expect(await subscriptionState(company.id)).toEqual(before);
  });

  it("improper_cancel → fatura cancelada, sem pagamento/receita, sem renovação", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const before = await subscriptionState(company.id);
    const res = await post(base(company.id, inv.id), {
      decision: "improper_cancel",
      note: "Fatura gerada em duplicidade no sistema antigo"
    });
    expect({ status: res.status, error: res.body?.error }).toEqual({ status: 201, error: undefined });
    expect((await Invoices.findByPk(inv.id))?.status).toBe("cancelled");
    expect(await rawPayments(inv.id)).toHaveLength(0);
    expect(await subscriptionState(company.id)).toEqual(before);
  });

  it("keep_pending → só registro; depois decisão terminal OK; segunda terminal → 409 ERR_HISTORICAL_ALREADY_REVIEWED", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const k = await post(base(company.id, inv.id), { decision: "keep_pending", note: "Aguardando extrato do cliente" });
    expect({ status: k.status, error: k.body?.error }).toEqual({ status: 201, error: undefined });
    expect((await Invoices.findByPk(inv.id))?.status).toBe("open");
    expect(await rawPayments(inv.id)).toHaveLength(0);

    const t1 = await post(base(company.id, inv.id), {
      decision: "historical_courtesy",
      note: "Cliente comprovou cortesia",
      confirmationSource: "contrato"
    });
    expect({ status: t1.status, error: t1.body?.error }).toEqual({ status: 201, error: undefined });

    const t2 = await post(base(company.id, inv.id), paymentBody());
    expect(t2.status).toBe(409);
    // A fatura já está paga: aceitamos o código de "já revisada" (contrato) e registramos se vier outro.
    expect(t2.body.error).toBe("ERR_HISTORICAL_ALREADY_REVIEWED");
    expect(await rawPayments(inv.id)).toHaveLength(1);
  });

  it("concorrência: duas decisões terminais simultâneas na mesma fatura → exatamente 1 efeito", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const [r1, r2] = await Promise.all([
      post(base(company.id, inv.id), paymentBody()),
      post(base(company.id, inv.id), { decision: "improper_cancel", note: "Cancelamento concorrente" })
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect({ statuses, bodies: [r1.body, r2.body] }).toMatchObject({ statuses: [201, 409] });
    const pays = await rawPayments(inv.id);
    const status = (await Invoices.findByPk(inv.id))?.status;
    // Exatamente um efeito: ou pago com 1 pagamento, ou cancelado sem pagamento.
    expect(
      (status === "paid" && pays.length === 1) || (status === "cancelled" && pays.length === 0)
    ).toBe(true);
    const [rows] = await sequelize.query(
      `select count(*)::int as n from "SaaSInvoiceHistoricalReviews" where "invoiceId" = :id and decision <> 'keep_pending'`,
      { replacements: { id: inv.id } }
    );
    expect((rows as any[])[0].n).toBe(1);
  });

  it("concorrência: duas historical_payment idênticas simultâneas → 1 pagamento, 1 receita", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const rs = await Promise.all([post(base(company.id, inv.id), paymentBody()), post(base(company.id, inv.id), paymentBody())]);
    expect(rs.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await rawPayments(inv.id)).toHaveLength(1);
    expect(await revenueOfInvoice(inv.id)).toBe(100);
  });

  it("conflito Efí: gatewayStatus CONCLUIDA → 409 ERR_HISTORICAL_EFI_CONFLICT", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, { externalTxid: `itF${Date.now()}a`, gatewayStatus: "CONCLUIDA" });
    const snap = await globalWriteSnapshot();
    const a = await post(base(company.id, inv.id), paymentBody({ efiChargeAcknowledged: true }));
    expect({ s: a.status, e: a.body.error }).toEqual({ s: 409, e: "ERR_HISTORICAL_EFI_CONFLICT" });
    expect(await globalWriteSnapshot()).toEqual(snap);
  });

  it("conflito Efí: conciliação pendente na fatura → 409 ERR_HISTORICAL_EFI_CONFLICT", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    await SaaSReconciliationItem.create({
      companyId: company.id,
      invoiceId: inv.id,
      kind: "manual_settle_divergence",
      status: "pending",
      message: "IT"
    } as any);
    const a = await post(base(company.id, inv.id), paymentBody());
    expect({ s: a.status, e: a.body.error }).toEqual({ s: 409, e: "ERR_HISTORICAL_EFI_CONFLICT" });
    expect(await rawPayments(inv.id)).toHaveLength(0);
  });

  it("conflito Efí: fatura (ainda aberta) com SaaSPayment de gateway → 409, sem novo pagamento", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const txid = `itF${Date.now()}b`;
    const inv = await createLegacyInvoice(company.id, { externalTxid: txid });
    await SaaSPayment.create({
      companyId: company.id,
      invoiceId: inv.id,
      amount: 100,
      method: "pix",
      source: "gateway",
      countsAsRevenue: true,
      paidAt: new Date(),
      externalTxid: txid,
      gatewayProvider: "efi"
    } as any);
    const a = await post(base(company.id, inv.id), paymentBody({ efiChargeAcknowledged: true }));
    expect(a.status).toBe(409);
    // Contrato: ERR_HISTORICAL_EFI_CONFLICT (a definição de candidata também exclui "com SaaSPayment").
    expect(["ERR_HISTORICAL_EFI_CONFLICT", "ERR_HISTORICAL_NOT_ELIGIBLE"]).toContain(a.body.error);
    expect(await rawPayments(inv.id)).toHaveLength(1);
  });

  it("cobrança Efí gerada sem pagamento: exige efiChargeAcknowledged (400 ERR_HISTORICAL_EFI_ACK_REQUIRED); com ack → 201", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, { externalTxid: `itF${Date.now()}c`, gatewayStatus: "ATIVA" });
    const p = await post(`${base(company.id, inv.id)}/preview`, paymentBody());
    expect(p.body.valid).toBe(false);
    expect(codesOf(p.body.errors)).toContain("ERR_HISTORICAL_EFI_ACK_REQUIRED");
    const a = await post(base(company.id, inv.id), paymentBody());
    expect({ s: a.status, e: a.body.error }).toEqual({ s: 400, e: "ERR_HISTORICAL_EFI_ACK_REQUIRED" });
    const ok = await post(base(company.id, inv.id), paymentBody({ efiChargeAcknowledged: true }));
    expect({ s: ok.status, e: ok.body.error }).toEqual({ s: 201, e: undefined });
  });

  it("isolamento: fatura de outra empresa → 404 (preview e apply), sem escrita", async () => {
    requireFeature(historicalRoutes);
    const owner = await createCompany({ dueDate: daysFromToday(-40) });
    const other = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(owner.id, {});
    const snap = await globalWriteSnapshot();
    const p = await post(`${base(other.id, inv.id)}/preview`, paymentBody());
    const a = await post(base(other.id, inv.id), paymentBody());
    expect([p.status, a.status]).toEqual([404, 404]);
    expect(await globalWriteSnapshot()).toEqual(snap);
  });

  it("fila: GET historical-review?companyId&state=pending lista candidata e não lista não candidata; summary conta", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const cand = await createLegacyInvoice(company.id, {});
    const nonCand = await createOpenInvoice(company.id, { dueDate: daysFromToday(-2) });
    const list = await request(app)
      .get(`/saas/finance/historical-review?companyId=${company.id}&state=pending&limit=50`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    const ids = (list.body.items || []).map((i: any) => i.invoice?.id);
    expect(ids).toContain(cand.id);
    expect(ids).not.toContain(nonCand.id);
    expect(list.body).toHaveProperty("count");
    expect(list.body).toHaveProperty("hasMore");
    const item = list.body.items.find((i: any) => i.invoice?.id === cand.id);
    expect(item.company).toMatchObject({ id: company.id });
    expect(item).toHaveProperty("signals");

    const sum = await request(app)
      .get(`/saas/finance/historical-review/summary`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(sum.status).toBe(200);
    expect(Number(sum.body.byCompany?.[company.id])).toBe(1);
    expect(typeof sum.body.total).toBe("number");
  });

  it("fila por estado: keep_pending → kept_pending (fora de pending); decisão terminal → resolved; summary deixa de contar", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const idsIn = async (state: string) => {
      const r = await request(app)
        .get(`/saas/finance/historical-review?companyId=${company.id}&state=${state}&limit=100`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(r.status).toBe(200);
      return (r.body.items || []).map((i: any) => i.invoice?.id);
    };
    const summaryOf = async () => {
      const r = await request(app).get(`/saas/finance/historical-review/summary`).set("Authorization", `Bearer ${superToken}`);
      return Number(r.body.byCompany?.[company.id] ?? 0);
    };
    expect(await idsIn("pending")).toContain(inv.id);
    await post(base(company.id, inv.id), { decision: "keep_pending", note: "Aguardando retorno do cliente" });
    expect(await idsIn("pending")).not.toContain(inv.id);
    expect(await idsIn("kept_pending")).toContain(inv.id);
    expect(await summaryOf()).toBe(1); // mantida pendente continua sendo pendência
    const t = await post(base(company.id, inv.id), { decision: "improper_cancel", note: "Fatura indevida confirmada" });
    expect(t.status).toBe(201);
    expect(await idsIn("kept_pending")).not.toContain(inv.id);
    expect(await idsIn("resolved")).toContain(inv.id);
    expect(await summaryOf()).toBe(0);
  });

  it("ledger: decisão gera evento historical_* com ator", async () => {
    requireFeature(historicalRoutes);
    const company = await createCompany({ dueDate: daysFromToday(-40) });
    const inv = await createLegacyInvoice(company.id, {});
    const res = await post(base(company.id, inv.id), { decision: "keep_pending", note: "Verificar com o financeiro" });
    expect(res.status).toBe(201);
    const [rows] = await sequelize.query(
      `select "eventType", "actorUserId" from "SaaSFinancialEvents" where "invoiceId" = :id`,
      { replacements: { id: inv.id } }
    );
    const evs = rows as any[];
    expect(evs.some(e => String(e.eventType).startsWith("historical_") && e.actorUserId === superUserId)).toBe(true);
  });
});
