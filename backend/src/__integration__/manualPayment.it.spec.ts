/**
 * Integração (Postgres real) — baixa manual (registerManualPayment).
 */
import sequelize from "../database";
import Invoices from "../models/Invoices";
import SaaSPayment from "../models/SaaSPayment";
import SaaSFinancialEvent from "../models/SaaSFinancialEvent";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import {
  DOMAIN_DATE_RE,
  assertDisposableDatabase,
  catchError,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  describeError,
  domainDate,
  rawRenewals,
  reloadCompany,
  today
} from "./helpers/fixtures";

const pay = (
  companyId: number,
  invoiceId: number,
  actorUserId: number,
  over: Record<string, unknown> = {}
) =>
  registerManualPayment({
    invoiceId,
    companyId,
    actorUserId,
    kind: "paid_offline",
    amount: 100,
    method: "pix_manual",
    paidAt: new Date(),
    reason: "Pagamento recebido por transferência",
    renewSubscription: true,
    ...over
  } as any);

describe("Baixa manual (Postgres real)", () => {
  let superUserId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("empresa vencida e bloqueada com fatura aberta → pagamento, fatura paid, ledger, renovação e desbloqueio", async () => {
    const due = daysFromToday(-10);
    const company = await createCompany({ dueDate: due, status: false, recurrence: "MENSAL" });
    expect(company.dueDate as unknown).toBeInstanceOf(Date);
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due });

    let result: any;
    const err = await catchError((async () => { result = await pay(company.id, invoice.id, superUserId); })());
    expect(describeError(err)).toBe("sem erro");

    expect(result.renewed).toBe(true);
    expect(result.renewalSkippedReason ?? null).toBeNull();
    expect(result.company?.status).toBe(true);
    expect(result.company?.dueDate).toMatch(DOMAIN_DATE_RE);

    const inv = await Invoices.findByPk(invoice.id);
    expect(inv?.status).toBe("paid");
    expect(inv?.paymentSource).toBe("paid_offline");

    const payments = await SaaSPayment.findAll({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);
    expect(Number(payments[0].amount)).toBe(100);
    expect(payments[0].countsAsRevenue).toBe(true);

    const ledger = await SaaSFinancialEvent.findAll({ where: { companyId: company.id } });
    const types = ledger.map(e => e.eventType);
    expect(types).toEqual(expect.arrayContaining(["manual_payment_recorded", "renewal_payment_confirmed"]));

    const after = await reloadCompany(company.id);
    expect(after.status).toBe(true);
    const newDue = domainDate(after.dueDate) as string;
    expect(newDue > today()).toBe(true);
    expect(result.company.dueDate).toBe(newDue);

    const rows = await rawRenewals(company.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].previousDueDate).toBe(due);
    expect(rows[0].newDueDate).toBe(newDue);
    expect(rows[0].invoiceId).toBe(invoice.id);
  });

  it("valor insuficiente → ERR_PAYMENT_AMOUNT_INSUFFICIENT sem estado parcial", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-5), status: false });
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    const before = await countState(company.id);

    const err = await catchError(pay(company.id, invoice.id, superUserId, { amount: 99.99 }));
    expect(err?.message).toBe("ERR_PAYMENT_AMOUNT_INSUFFICIENT");
    expect(err?.statusCode).toBe(400);

    expect(await countState(company.id)).toEqual(before);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("open");
    expect((await reloadCompany(company.id)).status).toBe(false);
  });

  it("valor acima da fatura → ERR_PAYMENT_AMOUNT_EXCEEDS sem estado parcial", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-5) });
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    const err = await catchError(pay(company.id, invoice.id, superUserId, { amount: 100.01 }));
    expect(err?.message).toBe("ERR_PAYMENT_AMOUNT_EXCEEDS");
    expect(await countState(company.id)).toEqual({ payments: 0, renewals: 0, events: 0 });
  });

  it("repetição na mesma fatura → ERR_INVOICE_NOT_OPEN (409) e nenhuma segunda renovação", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-5) });
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    await pay(company.id, invoice.id, superUserId);
    const dueAfterFirst = domainDate((await reloadCompany(company.id)).dueDate);

    const err = await catchError(pay(company.id, invoice.id, superUserId));
    expect(err?.message).toBe("ERR_INVOICE_NOT_OPEN");
    expect(err?.statusCode).toBe(409);

    const state = await countState(company.id);
    expect(state.payments).toBe(1);
    expect(state.renewals).toBe(1);
    expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(dueAfterFirst);
  });

  it("cortesia → countsAsRevenue=false e fatura paid com paymentSource courtesy", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-5) });
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    const err = await catchError(
      pay(company.id, invoice.id, superUserId, { kind: "courtesy", amount: 100, method: "courtesy" })
    );
    expect(describeError(err)).toBe("sem erro");

    const payments = await SaaSPayment.findAll({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].countsAsRevenue).toBe(false);
    expect(payments[0].source).toBe("courtesy");
    const inv = await Invoices.findByPk(invoice.id);
    expect(inv?.status).toBe("paid");
    expect(inv?.paymentSource).toBe("courtesy");
    const rows = await rawRenewals(company.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("courtesy");
  });

  it("concorrência: duas baixas simultâneas na mesma fatura → exatamente 1 pagamento e 1 renovação", async () => {
    const due = daysFromToday(-5);
    const company = await createCompany({ dueDate: due, status: false });
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due });

    const results = await Promise.allSettled([
      pay(company.id, invoice.id, superUserId),
      pay(company.id, invoice.id, superUserId)
    ]);
    const ok = results.filter(r => r.status === "fulfilled");
    const failed = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason?.message).toBe("ERR_INVOICE_NOT_OPEN");

    const state = await countState(company.id);
    expect(state.payments).toBe(1);
    expect(state.renewals).toBe(1);
  });

  it("rollback total quando a renovação falha (recorrência inválida SEMANAL)", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-5), status: false, recurrence: "SEMANAL" });
    const invoice = await createOpenInvoice(company.id, { value: 100 });

    const err = await catchError(pay(company.id, invoice.id, superUserId));
    expect(err?.message).toBe("ERR_INVALID_RECURRENCE");

    expect(await countState(company.id)).toEqual({ payments: 0, renewals: 0, events: 0 });
    const inv = await Invoices.findByPk(invoice.id);
    expect(inv?.status).toBe("open");
    expect(inv?.paidAt ?? null).toBeNull();
    expect((await reloadCompany(company.id)).status).toBe(false);
  });

  it("isolamento multiempresa: invoiceId de outra empresa → ERR_INVOICE_NOT_FOUND (404) sem efeitos", async () => {
    const owner = await createCompany({ dueDate: daysFromToday(-5) });
    const other = await createCompany({ dueDate: daysFromToday(-5) });
    const invoice = await createOpenInvoice(owner.id, { value: 100 });

    const err = await catchError(pay(other.id, invoice.id, superUserId));
    expect(err?.message).toBe("ERR_INVOICE_NOT_FOUND");
    expect(err?.statusCode).toBe(404);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("open");
    expect(await countState(owner.id)).toEqual({ payments: 0, renewals: 0, events: 0 });
    expect(await countState(other.id)).toEqual({ payments: 0, renewals: 0, events: 0 });
  });

  it("renovação administrativa prévia cobre o período da fatura → baixa não renova de novo (period_already_covered)", async () => {
    const invDue = daysFromToday(-5);
    // vencimento atual já muito à frente (cobre invDue + 1 mês)
    const company = await createCompany({ dueDate: daysFromToday(60), recurrence: "MENSAL" });
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: invDue });
    const result: any = await pay(company.id, invoice.id, superUserId);
    expect(result.renewed).toBe(false);
    expect(result.renewalSkippedReason).toBe("period_already_covered");
    expect(await rawRenewals(company.id)).toHaveLength(0);
    expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(daysFromToday(60));
  });
});
