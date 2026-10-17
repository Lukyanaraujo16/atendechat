/**
 * Fase 8.4-F (C6) — prévia da baixa manual: mesmo planejamento/validação da execução, sem escrita;
 * execução com expectedCurrentDueDate revalida sob lock (409 ERR_PAYMENT_STATE_CHANGED).
 * Usa o motor REAL de renovação (applySubscriptionRenewal) com modelos simulados.
 */
import moment from "moment-timezone";

const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

const companyState: any = {};
const invoiceState: any = {};

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => companyState) }
}));

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async (opts: any) =>
      opts?.where?.companyId === invoiceState.companyId && opts?.where?.id === invoiceState.id
        ? invoiceState
        : null
    ),
    count: jest.fn(async () => 0)
  }
}));

jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => null), findAll: jest.fn(async () => []) }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (data: any) => ({ id: 77, ...data })),
    count: jest.fn(async () => 0)
  }
}));

jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: { create: jest.fn(async (data: any) => ({ id: 1, ...data })) }
}));

jest.mock("../../../models/SaaSInvoiceHistoricalReview", () => ({
  __esModule: true,
  default: { count: jest.fn(async () => 0) }
}));

jest.mock("../../../models/SaaSSubscriptionRenewal", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (data: any) => ({ id: 1, ...data }))
  }
}));

jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => null)
}));

jest.mock("../efiCobrancasClient", () => ({ settleEfiCobrancasCharge: jest.fn() }));

jest.mock("../../../config/saasBillingFlags", () => ({
  saasBillingFlags: { cobrancasSettleEnabled: () => false }
}));

jest.mock("../../CompanyService/CreateCompanyLogService", () => ({
  createCompanyLog: jest.fn(async () => 1)
}));

jest.mock("../../CompanyService/notifySuperAdminsBilling", () => ({
  notifySuperAdminsBillingRenewal: jest.fn(async () => undefined),
  notifySuperAdminsBillingReactivated: jest.fn(async () => undefined)
}));

jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import { previewManualPayment, registerManualPayment } from "../registerManualPayment";
import SaaSPayment from "../../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../../models/SaaSSubscriptionRenewal";
import SaaSReconciliationItem from "../../../models/SaaSReconciliationItem";
import CompanyLog from "../../../models/CompanyLog";
import Invoices from "../../../models/Invoices";
import { recordFinancialEvent } from "../recordFinancialEvent";

const tz = "America/Sao_Paulo";
const today = () => moment.tz(tz).startOf("day");
const d = (m: moment.Moment) => m.format("YYYY-MM-DD");
const pgDate = (m: moment.Moment) => moment.tz(d(m), "YYYY-MM-DD", tz).toDate();

function reset(company: Record<string, unknown>, invoice: Record<string, unknown>) {
  for (const k of Object.keys(companyState)) delete companyState[k];
  for (const k of Object.keys(invoiceState)) delete invoiceState[k];
  Object.assign(companyState, {
    id: 5,
    name: "ACME",
    status: true,
    recurrence: "MENSAL",
    timezone: tz,
    update: jest.fn(async (data: any) => Object.assign(companyState, data)),
    reload: jest.fn(async () => companyState),
    ...company
  });
  Object.assign(invoiceState, {
    id: 10,
    companyId: 5,
    value: 200,
    status: "open",
    detail: "Mensalidade",
    dueDate: d(today().subtract(3, "days")),
    createdAt: new Date(),
    cycleKey: "2026-10",
    legacyUnknown: false,
    externalTxid: null,
    externalChargeId: null,
    gatewayProvider: null,
    update: jest.fn(async (data: any) => Object.assign(invoiceState, data)),
    reload: jest.fn(async () => invoiceState),
    ...invoice
  });
}

const body = {
  companyId: 5,
  invoiceId: 10,
  kind: "paid_offline",
  amount: 200,
  method: "pix",
  paidAt: "2026-10-17",
  reason: "Pix recebido na conta"
};

const expectNoWrites = () => {
  expect(SaaSPayment.create).not.toHaveBeenCalled();
  expect(SaaSReconciliationItem.create).not.toHaveBeenCalled();
  expect(SaaSSubscriptionRenewal.create).not.toHaveBeenCalled();
  expect(recordFinancialEvent).not.toHaveBeenCalled();
  expect(invoiceState.update).not.toHaveBeenCalled();
  expect(companyState.update).not.toHaveBeenCalled();
  expect(mockTransaction).not.toHaveBeenCalled();
};

describe("previewManualPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CompanyLog.findOne as jest.Mock).mockResolvedValue(null);
  });

  it("retorna o contrato C6 completo, sem nenhuma escrita", async () => {
    const due = today().subtract(3, "days");
    reset({ dueDate: pgDate(due), status: false }, {});
    (CompanyLog.findOne as jest.Mock).mockResolvedValue({ action: "auto_block" });

    const p = await previewManualPayment(body);
    expect(p).toEqual({
      valid: true,
      errors: [],
      alerts: [],
      company: { id: 5, name: "ACME" },
      invoice: { id: 10, value: 200, dueDate: d(due), status: "open", detail: "Mensalidade" },
      kind: "paid_offline",
      amount: 200,
      method: "pix",
      previousDueDate: d(due),
      newDueDate: d(due.clone().add(1, "months")),
      willRenew: true,
      renewalSkippedReason: null,
      revenueEffect: "revenue",
      invoiceStatusAfter: "paid",
      willUnblock: true,
      blockKind: "financial",
      expectedCurrentDueDate: d(due)
    });
    expectNoWrites();
  });

  it("prévia = execução: mesmo novo vencimento, renovação e desbloqueio", async () => {
    const cases = [
      { company: { dueDate: pgDate(today().subtract(3, "days")), status: false }, block: "block", invoice: {} },
      { company: { dueDate: pgDate(today().subtract(3, "days")), status: false }, block: "auto_block", invoice: {} },
      { company: { dueDate: pgDate(today().subtract(95, "days")) }, block: null, invoice: { dueDate: d(today().subtract(95, "days")) } },
      {
        company: { dueDate: pgDate(today().add(25, "days")) },
        block: null,
        invoice: { dueDate: d(today().subtract(6, "days")) }
      },
      { company: { dueDate: null }, block: null, invoice: {} }
    ];
    for (const c of cases) {
      jest.clearAllMocks();
      reset(c.company, c.invoice);
      (CompanyLog.findOne as jest.Mock).mockResolvedValue(c.block ? { action: c.block } : null);
      const p = await previewManualPayment(body);
      expect(p.valid).toBe(true);
      expectNoWrites();

      const r = await registerManualPayment({
        invoiceId: 10,
        companyId: 5,
        actorUserId: 1,
        kind: "paid_offline",
        amount: 200,
        method: "pix",
        paidAt: new Date("2026-10-17T12:00:00Z"),
        reason: "Pix recebido",
        expectedCurrentDueDate: p.expectedCurrentDueDate
      });
      expect(r.renewed).toBe(p.willRenew);
      expect(r.renewalSkippedReason).toBe(p.renewalSkippedReason);
      if (p.willRenew) expect(r.company?.dueDate).toBe(p.newDueDate);
      else expect(r.company?.dueDate).toBe(p.previousDueDate);
      expect(r.company?.status).toBe(c.company.status === false ? p.willUnblock : true);
    }
  });

  it("alertas: período coberto, bloqueio manual, ciclos pulados, cobrança Efí", async () => {
    reset(
      { dueDate: pgDate(today().add(25, "days")), status: false },
      { dueDate: d(today().subtract(6, "days")), externalTxid: "tx-1", gatewayProvider: "efi" }
    );
    (CompanyLog.findOne as jest.Mock).mockResolvedValue({ action: "block" });
    const p = await previewManualPayment(body);
    expect(p.willRenew).toBe(false);
    expect(p.newDueDate).toBeNull();
    expect(p.renewalSkippedReason).toBe("period_already_covered");
    expect(p.willUnblock).toBe(false);
    expect(p.blockKind).toBe("manual");
    expect(p.alerts.map(a => a.code)).toEqual(
      expect.arrayContaining(["PERIOD_ALREADY_COVERED", "MANUAL_BLOCK_KEEPS_BLOCKED", "EFI_CHARGE_EXISTS"])
    );

    reset({ dueDate: pgDate(today().subtract(70, "days")) }, {});
    const p2 = await previewManualPayment(body);
    expect(p2.alerts.map(a => a.code)).toContain("CYCLES_SKIPPED");
  });

  it("valor diferente: erro igual ao da execução + alerta AMOUNT_MISMATCH", async () => {
    reset({ dueDate: pgDate(today()) }, {});
    const p = await previewManualPayment({ ...body, amount: 150 });
    expect(p.valid).toBe(false);
    expect(p.errors.map(e => e.code)).toEqual(["ERR_PAYMENT_AMOUNT_INSUFFICIENT"]);
    expect(p.alerts.map(a => a.code)).toContain("AMOUNT_MISMATCH");
    await expect(
      registerManualPayment({
        invoiceId: 10,
        companyId: 5,
        actorUserId: 1,
        kind: "paid_offline",
        amount: 150,
        method: "pix",
        paidAt: new Date(),
        reason: "x".repeat(5)
      })
    ).rejects.toMatchObject({ message: "ERR_PAYMENT_AMOUNT_INSUFFICIENT" });

    const p2 = await previewManualPayment({ ...body, amount: 250 });
    expect(p2.errors.map(e => e.code)).toEqual(["ERR_PAYMENT_AMOUNT_EXCEEDS"]);

    // Cortesia: sem erro de valor, sem receita, valor registrado = valor da fatura.
    const p3 = await previewManualPayment({ ...body, kind: "courtesy", amount: 1 });
    expect(p3.valid).toBe(true);
    expect(p3.amount).toBe(200);
    expect(p3.revenueEffect).toBe("no_revenue");
  });

  it("fatura paga/cancelada: erro ERR_INVOICE_NOT_OPEN e alerta INVOICE_NOT_OPEN", async () => {
    reset({ dueDate: pgDate(today()) }, { status: "paid" });
    const p = await previewManualPayment(body);
    expect(p.valid).toBe(false);
    expect(p.errors.map(e => e.code)).toContain("ERR_INVOICE_NOT_OPEN");
    expect(p.alerts.map(a => a.code)).toContain("INVOICE_NOT_OPEN");
  });

  it("validações do corpo como erros (kind, método, motivo, data)", async () => {
    reset({ dueDate: pgDate(today()) }, {});
    const p = await previewManualPayment({
      ...body,
      kind: "xpto",
      method: "",
      reason: "",
      paidAt: "não é data"
    });
    expect(p.valid).toBe(false);
    expect(p.errors.map(e => e.code)).toEqual(
      expect.arrayContaining([
        "ERR_PAYMENT_KIND_INVALID",
        "ERR_PAYMENT_METHOD_REQUIRED",
        "ERR_MANUAL_PAYMENT_REASON_REQUIRED",
        "ERR_PAYMENT_DATE_INVALID"
      ])
    );
  });

  it("candidata histórica → alerta HISTORICAL_CANDIDATE", async () => {
    reset({ dueDate: pgDate(today()) }, { cycleKey: null, createdAt: new Date("2026-03-01T12:00:00Z") });
    const p = await previewManualPayment(body);
    expect(p.alerts.map(a => a.code)).toContain("HISTORICAL_CANDIDATE");
  });

  it("renewSubscription=false → disabled, sem novo vencimento", async () => {
    reset({ dueDate: pgDate(today()) }, {});
    const p = await previewManualPayment({ ...body, renewSubscription: false });
    expect(p.willRenew).toBe(false);
    expect(p.renewalSkippedReason).toBe("disabled");
    expect(p.newDueDate).toBeNull();
  });

  it("renovação já aplicada para a fatura (renew-invoice:<id>) → não renova de novo", async () => {
    reset({ dueDate: pgDate(today()) }, {});
    (SaaSSubscriptionRenewal.findOne as jest.Mock).mockResolvedValueOnce({ id: 3 });
    const p = await previewManualPayment(body);
    expect(SaaSSubscriptionRenewal.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: "renew-invoice:10" } })
    );
    expect(p.willRenew).toBe(false);
    expect(p.renewalSkippedReason).toBeNull();
  });

  it("isolamento: fatura de outra empresa → 404", async () => {
    reset({ dueDate: pgDate(today()) }, { companyId: 6 });
    await expect(previewManualPayment(body)).rejects.toMatchObject({
      message: "ERR_INVOICE_NOT_FOUND",
      statusCode: 404
    });
    expect(Invoices.findOne).toHaveBeenCalledWith({ where: { id: 10, companyId: 5 } });
  });

  it("expected divergente na prévia → ERR_PAYMENT_STATE_CHANGED", async () => {
    reset({ dueDate: pgDate(today().add(3, "days")) }, {});
    const p = await previewManualPayment({ ...body, expectedCurrentDueDate: d(today()) });
    expect(p.valid).toBe(false);
    expect(p.errors.map(e => e.code)).toContain("ERR_PAYMENT_STATE_CHANGED");
  });
});

describe("registerManualPayment com expectedCurrentDueDate", () => {
  beforeEach(() => jest.clearAllMocks());

  const input = {
    invoiceId: 10,
    companyId: 5,
    actorUserId: 1,
    kind: "paid_offline" as const,
    amount: 200,
    method: "pix",
    paidAt: new Date("2026-10-17T12:00:00Z"),
    reason: "Pix recebido"
  };

  it("vencimento mudou desde a prévia → 409 ERR_PAYMENT_STATE_CHANGED sem escrita", async () => {
    reset({ dueDate: pgDate(today().add(30, "days")) }, {});
    await expect(
      registerManualPayment({ ...input, expectedCurrentDueDate: d(today()) })
    ).rejects.toMatchObject({ message: "ERR_PAYMENT_STATE_CHANGED", statusCode: 409 });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(invoiceState.update).not.toHaveBeenCalled();
    expect(SaaSSubscriptionRenewal.create).not.toHaveBeenCalled();
  });

  it("expected null quando a empresa não tinha vencimento é aceito", async () => {
    reset({ dueDate: null }, {});
    const r = await registerManualPayment({ ...input, expectedCurrentDueDate: null });
    expect(r.renewed).toBe(true);
  });

  it("formato inválido → 400", async () => {
    reset({ dueDate: null }, {});
    await expect(
      registerManualPayment({ ...input, expectedCurrentDueDate: "17/10/2026" })
    ).rejects.toMatchObject({ message: "ERR_INVALID_DUE_DATE", statusCode: 400 });
  });

  it("cortesia não conta receita; pagamento exato conta", async () => {
    reset({ dueDate: pgDate(today()) }, {});
    await registerManualPayment({ ...input, kind: "courtesy", amount: 1 });
    expect(SaaSPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: "courtesy", countsAsRevenue: false, amount: 200 }),
      expect.anything()
    );
  });
});
