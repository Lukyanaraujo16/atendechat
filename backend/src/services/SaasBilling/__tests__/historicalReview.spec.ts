const mockTransaction = jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: "UPDATE" } }));

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));
jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));
jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn(), count: jest.fn() }
}));
jest.mock("../../../models/SaaSInvoiceHistoricalReview", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: { count: jest.fn(), findAll: jest.fn() }
}));
jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/User", () => ({ __esModule: true, default: {} }));
jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => ({ id: 900 }))
}));
// Spy: a regularização histórica NUNCA pode renovar a assinatura.
jest.mock("../applySubscriptionRenewal", () => ({
  applySubscriptionRenewal: jest.fn(),
  previewSubscriptionRenewal: jest.fn()
}));
jest.mock("../registerManualPayment", () => ({ registerManualPayment: jest.fn() }));

import Invoices from "../../../models/Invoices";
import Company from "../../../models/Company";
import SaaSPayment from "../../../models/SaaSPayment";
import SaaSInvoiceHistoricalReview from "../../../models/SaaSInvoiceHistoricalReview";
import SaaSReconciliationItem from "../../../models/SaaSReconciliationItem";
import CompanyLog from "../../../models/CompanyLog";
import { recordFinancialEvent } from "../recordFinancialEvent";
import { applySubscriptionRenewal } from "../applySubscriptionRenewal";
import { registerManualPayment } from "../registerManualPayment";
import {
  HISTORICAL_REVIEW_REFERENCE_DATE,
  applyHistoricalReview,
  computeSignals,
  countHistoricalReviewPending,
  getHistoricalReferenceDate,
  getHistoricalReviewSummary,
  isHistoricalCandidate,
  listHistoricalReviewQueue,
  previewHistoricalReview
} from "../HistoricalReviewService";

const TZ = "America/Sao_Paulo";

function makeInvoice(overrides: Record<string, unknown> = {}) {
  const inv: any = {
    id: 10,
    companyId: 5,
    status: "open",
    value: 99.9,
    dueDate: "2026-07-05",
    createdAt: new Date("2026-06-20T15:00:00.000Z"),
    cycleKey: "2026-07",
    legacyUnknown: false,
    recurrenceSnapshot: "MENSAL",
    externalTxid: null,
    externalChargeId: null,
    gatewayStatus: null,
    cancelledAt: null,
    paidAt: null,
    ...overrides
  };
  inv.update = jest.fn(async (data: any) => Object.assign(inv, data));
  inv.reload = jest.fn(async () => inv);
  return inv;
}

const company = {
  id: 5,
  name: "Acme",
  timezone: TZ,
  dueDate: new Date("2026-11-05T03:00:00.000Z"),
  recurrence: "MENSAL"
};

let invoice: any;

function setupContext(opts: {
  invoice?: any;
  payments?: any[];
  reviews?: any[];
  pendingRecon?: number;
  renewLogs?: any[];
} = {}) {
  invoice = opts.invoice || makeInvoice();
  (Invoices.findOne as jest.Mock).mockResolvedValue(invoice);
  (Company.findByPk as jest.Mock).mockResolvedValue(company);
  (SaaSPayment.findAll as jest.Mock).mockResolvedValue(opts.payments || []);
  (SaaSInvoiceHistoricalReview.findAll as jest.Mock).mockResolvedValue(opts.reviews || []);
  (SaaSReconciliationItem.count as jest.Mock).mockResolvedValue(opts.pendingRecon || 0);
  (CompanyLog.findAll as jest.Mock).mockResolvedValue(opts.renewLogs || []);
}

const target = { companyId: 5, invoiceId: 10 };
const paymentBody = {
  decision: "historical_payment",
  note: "Cliente pagou via Pix direto ao Alex",
  confirmationSource: "Extrato Itaú julho/2026",
  paidAt: "2026-07-04",
  amount: 99.9,
  method: "pix"
};

async function applyExpectError(input: any) {
  try {
    await applyHistoricalReview({ ...target, actorUserId: 1, input });
  } catch (err: any) {
    return err;
  }
  throw new Error("esperava erro");
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SAAS_HISTORICAL_REFERENCE_DATE;
  (SaaSPayment.create as jest.Mock).mockImplementation(async (data: any) => ({ id: 77, ...data }));
  (SaaSPayment.count as jest.Mock).mockResolvedValue(0);
  (SaaSInvoiceHistoricalReview.create as jest.Mock).mockImplementation(async (data: any) => ({
    id: 55,
    ...data
  }));
});

describe("isHistoricalCandidate (elegibilidade)", () => {
  it("referência no fuso da empresa: 16/10 23:00 em São Paulo é candidata; 17/10 00:00 não", () => {
    expect(HISTORICAL_REVIEW_REFERENCE_DATE).toBe("2026-10-17");
    const before = makeInvoice({ createdAt: new Date("2026-10-17T02:00:00.000Z") }); // 16/10 23h SP
    const at = makeInvoice({ createdAt: new Date("2026-10-17T03:00:00.000Z") }); // 17/10 00h SP
    expect(isHistoricalCandidate(before, { timezone: TZ })).toBe(true);
    expect(isHistoricalCandidate(at, { timezone: TZ })).toBe(false);
    // mesmo instante, fuso UTC: 17/10 02:00 → não candidata
    expect(isHistoricalCandidate(before, { timezone: "UTC" })).toBe(false);
  });

  it("legacyUnknown ou cycleKey nulo tornam candidata mesmo criada depois da referência", () => {
    const recent = { createdAt: new Date("2026-10-20T15:00:00.000Z") };
    expect(isHistoricalCandidate(makeInvoice({ ...recent, legacyUnknown: true }), company)).toBe(true);
    expect(isHistoricalCandidate(makeInvoice({ ...recent, cycleKey: null }), company)).toBe(true);
    expect(isHistoricalCandidate(makeInvoice(recent), company)).toBe(false);
  });

  it("paga, cancelada, com pagamento ou com decisão terminal não é candidata", () => {
    expect(isHistoricalCandidate(makeInvoice({ status: "paid" }), company)).toBe(false);
    expect(isHistoricalCandidate(makeInvoice({ status: "CANCELLED" }), company)).toBe(false);
    expect(isHistoricalCandidate(makeInvoice({ paymentsCount: 1 }), company)).toBe(false);
    expect(isHistoricalCandidate(makeInvoice({ hasTerminalReview: true }), company)).toBe(false);
    expect(isHistoricalCandidate(null, company)).toBe(false);
  });

  it("override por SAAS_HISTORICAL_REFERENCE_DATE (inválido é ignorado)", () => {
    process.env.SAAS_HISTORICAL_REFERENCE_DATE = "2026-06-01";
    expect(getHistoricalReferenceDate()).toBe("2026-06-01");
    expect(isHistoricalCandidate(makeInvoice(), company)).toBe(false);
    process.env.SAAS_HISTORICAL_REFERENCE_DATE = "lixo";
    expect(getHistoricalReferenceDate()).toBe("2026-10-17");
  });

  it("fatura com pagamento registrado → ERR_HISTORICAL_NOT_ELIGIBLE (sem receita duplicada)", async () => {
    setupContext({ payments: [{ id: 1, source: "paid_offline" }] });
    const err = await applyExpectError(paymentBody);
    expect(err).toMatchObject({ message: "ERR_HISTORICAL_NOT_ELIGIBLE", statusCode: 409 });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("fatura recente com ciclo → ERR_HISTORICAL_NOT_ELIGIBLE", async () => {
    setupContext({ invoice: makeInvoice({ createdAt: new Date("2026-10-18T15:00:00.000Z") }) });
    const err = await applyExpectError(paymentBody);
    expect(err).toMatchObject({ message: "ERR_HISTORICAL_NOT_ELIGIBLE", statusCode: 409 });
  });

  it("fatura já paga/cancelada → ERR_INVOICE_NOT_OPEN", async () => {
    setupContext({ invoice: makeInvoice({ status: "cancelled" }) });
    const err = await applyExpectError(paymentBody);
    expect(err).toMatchObject({ message: "ERR_INVOICE_NOT_OPEN", statusCode: 409 });
  });
});

describe("sinais (indícios)", () => {
  it("coveredByCurrentDueDate e adminRenewalsAfterDue no fuso da empresa", () => {
    const s = computeSignals({
      invoice: makeInvoice({ dueDate: "2026-07-05", externalTxid: "tx1" }),
      company,
      renewLogDates: [
        new Date("2026-07-05T03:30:00.000Z"), // 05/07 SP → conta
        new Date("2026-07-05T02:00:00.000Z"), // 04/07 23h SP → não conta
        new Date("2026-09-01T12:00:00.000Z")
      ],
      pendingReconciliation: false
    });
    expect(s).toMatchObject({
      coveredByCurrentDueDate: true,
      currentDueDate: "2026-11-05",
      invoiceCoverageEnd: "2026-08-05",
      adminRenewalsAfterDue: 2,
      efiCharge: true,
      pendingReconciliation: false
    });
  });
});

describe("historical_payment", () => {
  it("cria SaaSPayment de receita, fatura paga, ledger com ator/nota/fonte e NÃO renova", async () => {
    setupContext();
    const r: any = await applyHistoricalReview({ ...target, actorUserId: 1, input: paymentBody });

    expect((Invoices.findOne as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 10, companyId: 5 },
      lock: "UPDATE"
    });
    const pay = (SaaSPayment.create as jest.Mock).mock.calls[0][0];
    expect(pay).toMatchObject({
      companyId: 5,
      invoiceId: 10,
      amount: 99.9,
      method: "pix",
      source: "historical_payment",
      countsAsRevenue: true,
      recordedByUserId: 1,
      metadata: expect.objectContaining({ paidAtUnknown: false, historical: true })
    });
    expect(pay.paidAt.toISOString()).toBe("2026-07-04T12:00:00.000Z");
    expect(invoice.status).toBe("paid");
    expect(invoice.paymentSource).toBe("historical_payment");
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "historical_payment_recorded",
        actorUserId: 1,
        paymentId: 77,
        idempotencyKey: "historical:10",
        payload: expect.objectContaining({
          note: paymentBody.note,
          confirmationSource: paymentBody.confirmationSource,
          renewed: false
        })
      })
    );
    expect(SaaSInvoiceHistoricalReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "historical_payment", paymentId: 77, actorUserId: 1 }),
      expect.anything()
    );
    expect(r.review.id).toBe(55);
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
    expect(registerManualPayment).not.toHaveBeenCalled();
  });

  it("data desconhecida: paidAt NULL (fatura e pagamento), sem data inventada", async () => {
    setupContext();
    await applyHistoricalReview({
      ...target,
      actorUserId: 1,
      input: { ...paymentBody, paidAt: undefined, paidAtUnknown: true, method: "unknown" }
    });
    const pay = (SaaSPayment.create as jest.Mock).mock.calls[0][0];
    expect(pay.paidAt).toBeNull();
    expect(pay.method).toBe("unknown");
    expect(pay.metadata.paidAtUnknown).toBe(true);
    expect(invoice.paidAt).toBeNull();
    const rev = (SaaSInvoiceHistoricalReview.create as jest.Mock).mock.calls[0][0];
    expect(rev).toMatchObject({ paidAt: null, paidAtUnknown: true });
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("exige exatamente um entre paidAt e paidAtUnknown", async () => {
    setupContext();
    for (const body of [
      { ...paymentBody, paidAt: undefined },
      { ...paymentBody, paidAtUnknown: true }
    ]) {
      const err = await applyExpectError(body);
      expect(err).toMatchObject({ message: "ERR_HISTORICAL_PAID_AT_REQUIRED", statusCode: 400 });
    }
    const future = await applyExpectError({ ...paymentBody, paidAt: "2999-01-01" });
    expect(future.message).toBe("ERR_HISTORICAL_PAID_AT_INVALID");
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("valor exato: menor → INSUFFICIENT, maior → EXCEEDS, ausente → AMOUNT_REQUIRED", async () => {
    setupContext();
    expect((await applyExpectError({ ...paymentBody, amount: 99.89 })).message).toBe(
      "ERR_PAYMENT_AMOUNT_INSUFFICIENT"
    );
    expect((await applyExpectError({ ...paymentBody, amount: "99.91" })).message).toBe(
      "ERR_PAYMENT_AMOUNT_EXCEEDS"
    );
    expect((await applyExpectError({ ...paymentBody, amount: undefined })).message).toBe(
      "ERR_HISTORICAL_AMOUNT_REQUIRED"
    );
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("fonte e forma de pagamento obrigatórias (unknown só explícito)", async () => {
    setupContext();
    expect((await applyExpectError({ ...paymentBody, confirmationSource: " " })).message).toBe(
      "ERR_HISTORICAL_SOURCE_REQUIRED"
    );
    expect((await applyExpectError({ ...paymentBody, method: undefined })).message).toBe(
      "ERR_HISTORICAL_METHOD_REQUIRED"
    );
    expect((await applyExpectError({ ...paymentBody, method: "bitcoin" })).message).toBe(
      "ERR_HISTORICAL_METHOD_INVALID"
    );
    expect((await applyExpectError({ ...paymentBody, note: "ok" })).message).toBe(
      "ERR_HISTORICAL_NOTE_REQUIRED"
    );
  });
});

describe("historical_courtesy", () => {
  it("SaaSPayment sem receita, fatura paga, sem renovação, data desconhecida quando não informada", async () => {
    setupContext();
    await applyHistoricalReview({
      ...target,
      actorUserId: 1,
      input: { decision: "historical_courtesy", note: "Mês cedido na migração", confirmationSource: "Acordo por WhatsApp" }
    });
    const pay = (SaaSPayment.create as jest.Mock).mock.calls[0][0];
    expect(pay).toMatchObject({
      source: "historical_courtesy",
      countsAsRevenue: false,
      amount: 99.9,
      paidAt: null,
      method: "unknown"
    });
    expect(invoice.status).toBe("paid");
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "historical_courtesy_recorded" })
    );
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("exige fonte da confirmação", async () => {
    setupContext();
    const err = await applyExpectError({ decision: "historical_courtesy", note: "Mês cedido" });
    expect(err.message).toBe("ERR_HISTORICAL_SOURCE_REQUIRED");
  });
});

describe("improper_cancel", () => {
  it("cancela (soft) com a semântica do cancelamento, ledger historical_invoice_cancelled, sem receita", async () => {
    setupContext();
    const r: any = await applyHistoricalReview({
      ...target,
      actorUserId: 1,
      input: { decision: "improper_cancel", note: "Fatura gerada em duplicidade em 2025" }
    });
    expect(invoice.status).toBe("cancelled");
    expect(invoice.cancelledAt).toBeInstanceOf(Date);
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(recordFinancialEvent).toHaveBeenCalledTimes(1);
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "historical_invoice_cancelled",
        actorUserId: 1,
        payload: expect.objectContaining({
          reason: "Fatura gerada em duplicidade em 2025",
          historical: true
        })
      })
    );
    expect(r.payment).toBeNull();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });
});

describe("keep_pending", () => {
  it("só registra (fatura inalterada) e permite decisão terminal depois", async () => {
    setupContext();
    await applyHistoricalReview({
      ...target,
      actorUserId: 1,
      input: { decision: "keep_pending", note: "Aguardando extrato do cliente" }
    });
    expect(invoice.update).not.toHaveBeenCalled();
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "historical_review_kept_pending", idempotencyKey: null })
    );

    // depois: decisão terminal ainda permitida
    jest.clearAllMocks();
    (SaaSPayment.create as jest.Mock).mockImplementation(async (d: any) => ({ id: 78, ...d }));
    (SaaSInvoiceHistoricalReview.create as jest.Mock).mockImplementation(async (d: any) => ({ id: 56, ...d }));
    setupContext({ reviews: [{ id: 55, decision: "keep_pending" }] });
    const preview: any = await previewHistoricalReview({ ...target, input: paymentBody });
    expect(preview.valid).toBe(true);
    expect(preview.alerts.map((a: any) => a.code)).toContain("PREVIOUSLY_KEPT_PENDING");
    await applyHistoricalReview({ ...target, actorUserId: 1, input: paymentBody });
    expect(invoice.status).toBe("paid");
  });
});

describe("idempotência", () => {
  it("segunda decisão terminal → 409 ERR_HISTORICAL_ALREADY_REVIEWED (inclusive keep_pending)", async () => {
    setupContext({ reviews: [{ id: 1, decision: "historical_payment" }] });
    for (const input of [paymentBody, { decision: "keep_pending", note: "de novo pendente" }]) {
      const err = await applyExpectError(input);
      expect(err).toMatchObject({ message: "ERR_HISTORICAL_ALREADY_REVIEWED", statusCode: 409 });
    }
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("violação do índice único parcial (corrida) → 409 ERR_HISTORICAL_ALREADY_REVIEWED", async () => {
    setupContext();
    (SaaSInvoiceHistoricalReview.create as jest.Mock).mockRejectedValueOnce({
      name: "SequelizeUniqueConstraintError",
      parent: { constraint: "saas_hist_reviews_terminal_unique" }
    });
    const err = await applyExpectError(paymentBody);
    expect(err).toMatchObject({ message: "ERR_HISTORICAL_ALREADY_REVIEWED", statusCode: 409 });
  });
});

describe("conflito Efí", () => {
  it.each([
    ["pagamento gateway", { payments: [{ id: 1, source: "gateway" }] }],
    ["gatewayStatus CONCLUIDA", { invoice: makeInvoice({ gatewayStatus: "CONCLUIDA", externalTxid: "tx" }) }],
    ["conciliação pendente", { pendingRecon: 1 }]
  ])("%s → 409 ERR_HISTORICAL_EFI_CONFLICT", async (_label, ctx) => {
    setupContext(ctx as any);
    const err = await applyExpectError({ ...paymentBody, efiChargeAcknowledged: true });
    expect(err).toMatchObject({ message: "ERR_HISTORICAL_EFI_CONFLICT", statusCode: 409 });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("cobrança Efí gerada sem pagamento exige efiChargeAcknowledged", async () => {
    setupContext({ invoice: makeInvoice({ externalTxid: "tx-abc", gatewayStatus: "ATIVA" }) });
    const err = await applyExpectError(paymentBody);
    expect(err).toMatchObject({ message: "ERR_HISTORICAL_EFI_ACK_REQUIRED", statusCode: 400 });
    const cancelErr = await applyExpectError({ decision: "improper_cancel", note: "Indevida, conferido" });
    expect(cancelErr.message).toBe("ERR_HISTORICAL_EFI_ACK_REQUIRED");

    await applyHistoricalReview({
      ...target,
      actorUserId: 1,
      input: { ...paymentBody, efiChargeAcknowledged: true }
    });
    const pay = (SaaSPayment.create as jest.Mock).mock.calls[0][0];
    expect(pay.externalTxid).toBeNull();
    expect(pay.metadata).toMatchObject({ externalTxid: "tx-abc", efiChargeAcknowledged: true });
  });
});

describe("prévia = execução", () => {
  const cases: Array<[string, any, any]> = [
    ["valor menor", {}, { ...paymentBody, amount: 10 }],
    ["sem data", {}, { ...paymentBody, paidAt: undefined }],
    ["ack Efí", { invoice: makeInvoice({ externalChargeId: "ch1" }) }, paymentBody],
    ["conflito Efí", { pendingRecon: 2 }, paymentBody],
    ["já revisada", { reviews: [{ id: 1, decision: "improper_cancel" }] }, paymentBody],
    ["não elegível", { payments: [{ id: 3, source: "courtesy" }] }, paymentBody],
    ["decisão inválida", {}, { ...paymentBody, decision: "renew" }]
  ];

  it.each(cases)("%s: primeiro erro da prévia é o erro da execução", async (_l, ctx, body) => {
    setupContext(ctx);
    const preview: any = await previewHistoricalReview({ ...target, input: body });
    expect(preview.valid).toBe(false);
    expect(preview.willRenew).toBe(false);
    setupContext(ctx);
    const err = await applyExpectError(body);
    expect(err.message).toBe(preview.errors[0].code);
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(SaaSInvoiceHistoricalReview.create).not.toHaveBeenCalled();
  });

  it("prévia válida descreve exatamente o efeito, sem escrita e sem lock", async () => {
    setupContext();
    const preview: any = await previewHistoricalReview({
      ...target,
      input: { ...paymentBody, paidAt: undefined, paidAtUnknown: true }
    });
    expect(preview).toMatchObject({
      valid: true,
      errors: [],
      decision: "historical_payment",
      revenueEffect: "revenue",
      invoiceStatusAfter: "paid",
      willRenew: false,
      payment: { amount: 99.9, paidAt: null, paidAtUnknown: true }
    });
    expect(preview.alerts.map((a: any) => a.code)).toEqual(
      expect.arrayContaining(["PAID_AT_UNKNOWN", "NO_RENEWAL"])
    );
    expect((Invoices.findOne as jest.Mock).mock.calls[0][0].lock).toBeUndefined();
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(recordFinancialEvent).not.toHaveBeenCalled();
    expect(invoice.update).not.toHaveBeenCalled();
  });

  it("prévia de cortesia/cancelamento: sem receita", async () => {
    setupContext();
    const c: any = await previewHistoricalReview({
      ...target,
      input: { decision: "historical_courtesy", note: "cortesia antiga", confirmationSource: "e-mail" }
    });
    expect(c).toMatchObject({ valid: true, revenueEffect: "no_revenue", invoiceStatusAfter: "paid" });
    const x: any = await previewHistoricalReview({
      ...target,
      input: { decision: "improper_cancel", note: "fatura indevida" }
    });
    expect(x).toMatchObject({ valid: true, revenueEffect: "no_revenue", invoiceStatusAfter: "cancelled", payment: null });
  });
});

describe("fila e contagem", () => {
  function row(overrides: Record<string, unknown>) {
    const inv: any = makeInvoice(overrides);
    inv.company = { id: inv.companyId, name: `Empresa ${inv.companyId}`, timezone: TZ, dueDate: null, recurrence: "MENSAL" };
    inv.toJSON = () => {
      const { update, reload, toJSON, ...rest } = inv;
      return { ...rest };
    };
    return inv;
  }

  beforeEach(() => {
    (Invoices.findAll as jest.Mock).mockResolvedValue([
      row({ id: 1, companyId: 5 }),
      row({ id: 2, companyId: 5, createdAt: new Date("2026-10-20T12:00:00.000Z") }), // recente → fora
      row({ id: 3, companyId: 6, createdAt: new Date("2026-10-20T12:00:00.000Z"), cycleKey: null }),
      row({ id: 4, companyId: 6, legacyUnknown: true })
    ]);
    (SaaSInvoiceHistoricalReview.findAll as jest.Mock).mockImplementation(async (q: any) =>
      q.where.decision === "keep_pending" ? [{ invoiceId: 4 }] : []
    );
    (SaaSReconciliationItem.findAll as jest.Mock).mockResolvedValue([{ invoiceId: 3 }]);
    (CompanyLog.findAll as jest.Mock).mockResolvedValue([]);
  });

  it("countHistoricalReviewPending usa classificação no fuso e filtra companyId no where", async () => {
    expect(await countHistoricalReviewPending()).toBe(3);
    await countHistoricalReviewPending(5);
    const where = (Invoices.findAll as jest.Mock).mock.calls[1][0].where;
    expect(where.companyId).toBe(5);
  });

  it("summary agrupa por empresa", async () => {
    const s = await getHistoricalReviewSummary();
    expect(s).toEqual({ total: 3, pending: 2, keptPending: 1, byCompany: { 5: 1, 6: 2 } });
  });

  it("listagem: state pending/kept_pending, sinais e bloqueio por conciliação", async () => {
    const pending: any = await listHistoricalReviewQueue({ state: "pending" });
    expect(pending.items.map((i: any) => i.invoice.id)).toEqual([1, 3]);
    expect(pending.count).toBe(2);
    const i3 = pending.items.find((i: any) => i.invoice.id === 3);
    expect(i3.signals.pendingReconciliation).toBe(true);
    expect(i3.blockedReason).toMatch(/concilia/);
    expect(i3.company).toEqual({ id: 6, name: "Empresa 6" });

    const kept: any = await listHistoricalReviewQueue({ state: "kept_pending" });
    expect(kept.items.map((i: any) => i.invoice.id)).toEqual([4]);

    const paged: any = await listHistoricalReviewQueue({ state: "pending", page: 1, limit: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.hasMore).toBe(true);
  });
});
