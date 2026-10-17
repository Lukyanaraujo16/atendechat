jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findAndCountAll: jest.fn() }
}));
jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/SaaSSubscriptionRenewal", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/SaaSFinancialEvent", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../HistoricalReviewService", () => ({
  countHistoricalReviewPending: jest.fn(async () => 2)
}));
jest.mock("../../../helpers/companyFinanceStatus", () => ({
  getCompanyFinanceFlags: jest.fn(() => ({ overdue: false }))
}));

import moment from "moment-timezone";
import Company from "../../../models/Company";
import Invoices from "../../../models/Invoices";
import SaaSPayment from "../../../models/SaaSPayment";
import {
  getCompanyFinanceSummary,
  listCompanyInvoices
} from "../ListCompanyFinanceService";

const tz = "America/Sao_Paulo";
const past = moment.tz(tz).subtract(5, "days").format("YYYY-MM-DD");
const future = moment.tz(tz).add(5, "days").format("YYYY-MM-DD");

describe("getCompanyFinanceSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calcula totals billed/received/courtesy/open/overdue e mantém campos legados", async () => {
    const dueDate = new Date(`${future}T03:00:00.000Z`);
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 5,
      name: "Acme",
      planId: 3,
      plan: { id: 3, name: "Pro", value: "100" },
      contractedPlanValue: "89.9",
      recurrence: "MENSAL",
      timezone: tz,
      dueDate,
      status: true
    });
    (Invoices.findAll as jest.Mock).mockResolvedValue([
      { id: 1, status: "paid", value: 100, dueDate: past },
      { id: 2, status: "open", value: 50, dueDate: past }, // vencida
      { id: 3, status: "open", value: 30.5, dueDate: future },
      { id: 4, status: "cancelled", value: 999, dueDate: past },
      { id: 5, status: "open", value: 20, dueDate: `${past}T00:00:00-03:00` } // legado ISO
    ]);
    (SaaSPayment.findAll as jest.Mock).mockResolvedValue([
      { amount: "100.00", countsAsRevenue: true, paidAt: new Date() },
      { amount: "40.00", countsAsRevenue: false, paidAt: new Date() }
    ]);

    const s: any = await getCompanyFinanceSummary(5);

    expect(s.totals).toMatchObject({
      billed: 200.5,
      invoiced: 200.5,
      received: 100,
      courtesy: 40,
      open: 100.5,
      overdue: 70,
      receivedDateUnknown: 0,
      historicalPending: 2
    });
    expect(s.nextDueDate).toBe(future);
    expect(s.plan).toEqual({ id: 3, name: "Pro" });
    expect(s.planName).toBe("Pro");
    expect(s.contractedValue).toBe(89.9);
    // compat tenant (frontend/src/pages/Financeiro)
    expect(s.dueDate).toBe(dueDate);
    expect(SaaSPayment.findAll).toHaveBeenCalledWith({ where: { companyId: 5 } });
  });
});

describe("getCompanyFinanceSummary — regularização histórica", () => {
  beforeEach(() => jest.clearAllMocks());

  it("receita histórica conta como recebida (data desconhecida separada); cortesia histórica fora da receita; cancelada sai do em aberto", async () => {
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 5, name: "Acme", planId: null, plan: null, recurrence: "MENSAL", timezone: tz, dueDate: null, status: true
    });
    (Invoices.findAll as jest.Mock).mockResolvedValue([
      { id: 1, status: "paid", value: 100, dueDate: past },
      { id: 2, status: "paid", value: 50, dueDate: past },
      { id: 3, status: "cancelled", value: 70, dueDate: past },
      { id: 4, status: "open", value: 30, dueDate: past }
    ]);
    (SaaSPayment.findAll as jest.Mock).mockResolvedValue([
      { amount: "100.00", countsAsRevenue: true, source: "historical_payment", paidAt: null },
      { amount: "50.00", countsAsRevenue: false, source: "historical_courtesy", paidAt: null }
    ]);
    const s: any = await getCompanyFinanceSummary(5);
    expect(s.totals).toMatchObject({
      received: 100,
      receivedDateUnknown: 100,
      historicalReceived: 100,
      courtesy: 50,
      historicalCourtesy: 50,
      open: 30,
      openCount: 1,
      historicalPending: 2
    });
  });
});

describe("listCompanyInvoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Company.findByPk as jest.Mock).mockResolvedValue({ id: 5, timezone: tz });
  });

  it("deriva isLegacy, isOverdue e paymentsCount", async () => {
    (Invoices.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 3,
      rows: [
        { id: 1, status: "open", dueDate: past, cycleKey: "2026-10", legacyUnknown: false },
        { id: 2, status: "paid", dueDate: past, cycleKey: null, legacyUnknown: false },
        { id: 3, status: "open", dueDate: future, cycleKey: "2026-11", legacyUnknown: true }
      ]
    });
    (SaaSPayment.findAll as jest.Mock).mockResolvedValue([
      { invoiceId: 2, count: "2" }
    ]);

    const r: any = await listCompanyInvoices(5, {});
    const byId = Object.fromEntries(r.invoices.map((i: any) => [i.id, i]));
    expect(byId[1]).toMatchObject({ isLegacy: false, isOverdue: true, paymentsCount: 0 });
    expect(byId[2]).toMatchObject({ isLegacy: true, isOverdue: false, paymentsCount: 2 });
    expect(byId[3]).toMatchObject({ isLegacy: true, isOverdue: false });
    expect((SaaSPayment.findAll as jest.Mock).mock.calls[0][0].where.companyId).toBe(5);
  });

  it("aplica filtros status e legacy sempre com companyId", async () => {
    (Invoices.findAndCountAll as jest.Mock).mockResolvedValue({ count: 0, rows: [] });
    await listCompanyInvoices(5, { status: "open", legacy: false });
    const where = (Invoices.findAndCountAll as jest.Mock).mock.calls[0][0].where;
    expect(where.companyId).toBe(5);
    expect(where.status).toBe("open");
    expect(where.cycleKey).toBeDefined();
    expect(where.legacyUnknown).toBeDefined();

    await listCompanyInvoices(5, { legacy: true });
    const where2 = (Invoices.findAndCountAll as jest.Mock).mock.calls[1][0].where;
    expect(where2.companyId).toBe(5);
    expect(Object.getOwnPropertySymbols(where2).length).toBe(1);
  });
});
