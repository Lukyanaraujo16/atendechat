/**
 * Fase 8.4-F (F1/C3) — Central de assinatura: status separados, fontes autoritativas, paidAt nulo.
 */
jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));

const state: any = { company: null, payment: null, invoices: [], logs: [], paidInvoiceIds: [], terminal: [] };

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(async (id: number) => (state.company && state.company.id === id ? state.company : null))
  }
}));
jest.mock("../../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => state.logs), findOne: jest.fn(async () => null) }
}));
jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => state.invoices) }
}));
jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => state.payment),
    findAll: jest.fn(async () => state.paidInvoiceIds.map((invoiceId: number) => ({ invoiceId })))
  }
}));
jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: { count: jest.fn(async () => 2) }
}));
jest.mock("../../../models/SaaSInvoiceHistoricalReview", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => state.terminal.map((invoiceId: number) => ({ invoiceId }))) }
}));
jest.mock("../../SystemSettingService/GetSystemBillingSettingsService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    daysBeforeDueWarning: 3,
    daysAfterDueWarning: 1,
    daysAfterDueBlock: 5,
    enableAutoBlock: true,
    enableAutoWarning: true,
    enableAutoWhatsAppWarning: false,
    whatsappSenderCompanyId: 1
  }))
}));
jest.mock("../HistoricalReviewService", () => {
  const actual = jest.requireActual("../HistoricalReviewService");
  return { ...actual, countHistoricalReviewPending: jest.fn(async () => 4) };
});

import { getSubscriptionCenter } from "../SubscriptionCenterService";
import SaaSPayment from "../../../models/SaaSPayment";
import Invoices from "../../../models/Invoices";
import SaaSReconciliationItem from "../../../models/SaaSReconciliationItem";
import { countHistoricalReviewPending } from "../HistoricalReviewService";

const TODAY = "2026-10-17";
const tz = "America/Sao_Paulo";
const pg = (s: string) => new Date(`${s}T03:00:00.000Z`); // meia-noite em São Paulo

const company = (patch: Record<string, unknown> = {}) => ({
  id: 5,
  name: "ACME",
  status: true,
  timezone: tz,
  recurrence: "MENSAL",
  dueDate: pg("2026-10-20"),
  contractedPlanValue: null,
  plan: { id: 2, name: "Pro", value: "149.90" },
  ...patch
});

const inv = (id: number, patch: Record<string, unknown> = {}) => ({
  id,
  companyId: 5,
  status: "open",
  value: 149.9,
  dueDate: "2026-10-20",
  cycleKey: "2026-10",
  legacyUnknown: false,
  createdAt: new Date("2026-10-18T12:00:00Z"),
  ...patch
});

beforeEach(() => {
  jest.clearAllMocks();
  state.company = company();
  state.payment = null;
  state.invoices = [];
  state.logs = [];
  state.paidInvoiceIds = [];
  state.terminal = [];
});

describe("getSubscriptionCenter", () => {
  it("empresa ativa com assinatura vencida: status separados (ativa ≠ em dia)", async () => {
    state.company = company({ dueDate: pg("2026-10-07") });
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.status).toEqual({
      operational: "ativa",
      blockKind: "none",
      financial: "vencido",
      subscription: "vencida",
      daysLate: 10,
      daysUntilDue: 0
    });
    expect(r.currentDueDate).toBe("2026-10-07");
    // Mesma regra da renovação: âncora preservada, estritamente no futuro.
    expect(r.nextCycleDueDate).toBe("2026-11-07");
  });

  it("em carência (atraso < daysAfterDueBlock das configurações reais)", async () => {
    state.company = company({ dueDate: pg("2026-10-15") });
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.status.financial).toBe("carencia");
    expect(r.status.subscription).toBe("vencida");
    expect(r.status.daysLate).toBe(2);
  });

  it("bloqueada manualmente com assinatura em dia", async () => {
    state.company = company({ status: false, dueDate: pg("2026-11-30") });
    state.logs = [{ companyId: 5, action: "block" }];
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.status).toMatchObject({
      operational: "bloqueada",
      blockKind: "manual",
      financial: "em_dia",
      subscription: "em_dia",
      daysUntilDue: 44
    });
  });

  it("bloqueio sem registro → unknown; vence hoje ainda é em dia", async () => {
    state.company = company({ status: false, dueDate: pg(TODAY) });
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.status.blockKind).toBe("unknown");
    expect(r.status.financial).toBe("vence_hoje");
    expect(r.status.subscription).toBe("em_dia");
  });

  it("sem vencimento", async () => {
    state.company = company({ dueDate: null });
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.currentDueDate).toBeNull();
    expect(r.status.subscription).toBe("sem_vencimento");
    expect(r.status.financial).toBe("sem_vencimento");
    expect(r.nextCycleDueDate).toBe("2026-11-17");
  });

  it("plano, recorrência, meses e valor contratado (override)", async () => {
    state.company = company({ recurrence: "trimestral", contractedPlanValue: "120.00" });
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.company).toEqual({ id: 5, name: "ACME", timezone: tz });
    expect(r.plan).toEqual({ id: 2, name: "Pro" });
    expect(r.recurrence).toBe("TRIMESTRAL");
    expect(r.months).toBe(3);
    expect(r.contractedValue).toBe(120);
    expect(r.nextCycleDueDate).toBe("2027-01-20");
  });

  it("último pagamento só conta receita; paidAt nulo → paidAtUnknown", async () => {
    state.payment = {
      id: 9,
      invoiceId: 3,
      amount: "149.90",
      paidAt: null,
      method: "unknown",
      source: "historical_payment",
      metadata: { paidAtUnknown: true }
    };
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(SaaSPayment.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 5, countsAsRevenue: true },
        order: [
          ["paidAt", "DESC NULLS LAST"],
          ["id", "DESC"]
        ]
      })
    );
    expect(r.lastConfirmedPayment).toEqual({
      id: 9,
      invoiceId: 3,
      amount: 149.9,
      paidAt: null,
      paidAtUnknown: true,
      method: "unknown",
      source: "historical_payment"
    });
  });

  it("paidAt conhecido vira data de domínio no fuso da empresa", async () => {
    state.payment = {
      id: 9,
      invoiceId: 3,
      amount: 100,
      paidAt: new Date("2026-10-17T02:00:00Z"),
      method: "pix",
      source: "gateway",
      metadata: null
    };
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.lastConfirmedPayment).toMatchObject({ paidAt: "2026-10-16", paidAtUnknown: false });
  });

  it("pendências e próxima cobrança (prioriza fatura atual sobre candidata histórica)", async () => {
    state.invoices = [
      inv(1, { dueDate: "2026-03-10", cycleKey: null, createdAt: new Date("2026-03-01T12:00:00Z") }),
      inv(2, { dueDate: "2026-10-10", value: 100 }),
      inv(3, { dueDate: "2026-11-10", value: 50 }),
      inv(4, { status: "PAID" })
    ];
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(Invoices.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 5 }) })
    );
    expect(r.pendencies).toEqual({
      openInvoices: 3,
      overdueInvoices: 2,
      openAmount: 299.9,
      reconciliationPending: 2,
      historicalReviewPending: 4
    });
    expect(SaaSReconciliationItem.count).toHaveBeenCalledWith({
      where: { companyId: 5, status: "pending" }
    });
    expect(countHistoricalReviewPending).toHaveBeenCalledWith(5);
    expect(r.nextExpectedCharge).toEqual({
      invoiceId: 2,
      value: 100,
      dueDate: "2026-10-10",
      isHistoricalCandidate: false
    });
  });

  it("só candidatas históricas → próxima cobrança é a histórica, sinalizada", async () => {
    state.invoices = [inv(1, { dueDate: "2026-03-10", legacyUnknown: true })];
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.nextExpectedCharge).toMatchObject({ invoiceId: 1, isHistoricalCandidate: true });
  });

  it("fatura aberta com pagamento registrado não é candidata histórica", async () => {
    state.invoices = [inv(1, { legacyUnknown: true })];
    state.paidInvoiceIds = [1];
    const r = await getSubscriptionCenter(5, { today: TODAY });
    expect(r.nextExpectedCharge?.isHistoricalCandidate).toBe(false);
  });

  it("empresa inexistente → 404", async () => {
    await expect(getSubscriptionCenter(999, { today: TODAY })).rejects.toMatchObject({
      message: "ERR_NO_COMPANY_FOUND",
      statusCode: 404
    });
  });
});
