jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findAndCountAll: jest.fn() }
}));
jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findAndCountAll: jest.fn() }
}));
jest.mock("../HistoricalReviewService", () => ({
  countHistoricalReviewPending: jest.fn(async () => 4)
}));
jest.mock("../ListCompanyFinanceService", () => ({
  withPaidAtUnknown: (p: any) => ({ ...p, paidAtUnknown: p.paidAt == null })
}));
jest.mock("../../../helpers/companyFinanceStatus", () => ({
  getCompanyFinanceFlags: jest.fn(() => ({ overdue: false, delinquent: false }))
}));

import { Op } from "sequelize";
import Company from "../../../models/Company";
import Invoices from "../../../models/Invoices";
import SaaSPayment from "../../../models/SaaSPayment";
import {
  getPlatformFinanceKpis,
  listPlatformPayments
} from "../PlatformFinanceDashboardService";

const now = new Date();

function mockData() {
  (Company.findAll as jest.Mock).mockResolvedValue([]);
  (Invoices.findAll as jest.Mock).mockResolvedValue([
    { status: "paid", value: 100, dueDate: "2026-01-05", createdAt: now },
    { status: "cancelled", value: 70, dueDate: "2026-01-05", createdAt: now },
    { status: "open", value: 30, dueDate: "2999-01-05", createdAt: now }
  ]);
  (SaaSPayment.findAll as jest.Mock).mockImplementation(async (q: any) => {
    if (q.where.paidAt === null) {
      return [{ amount: "80.00", source: "historical_payment", paidAt: null }];
    }
    return [{ amount: "100.00", source: "paid_offline", paidAt: now }];
  });
}

describe("PlatformFinanceDashboardService — pagamentos sem data (regularização histórica)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData();
  });

  it("sem período: data desconhecida entra no recebido, aparece separada e fica fora da evolução mensal", async () => {
    const k: any = await getPlatformFinanceKpis();
    expect(k.received).toBe(180);
    expect(k.receivedDateUnknown).toBe(80);
    expect(k.receivedIncludesDateUnknown).toBe(true);
    expect(k.historicalReceived).toBe(80);
    expect(k.historicalPending).toBe(4);
    expect(k.open).toBe(30); // cancelada não conta como em aberto
    const evoTotal = k.evolution.reduce((acc: number, e: any) => acc + e.received, 0);
    expect(evoTotal).toBe(100);
    const datedWhere = (SaaSPayment.findAll as jest.Mock).mock.calls[0][0].where;
    expect(datedWhere.paidAt[Op.not]).toBeNull();
  });

  it("com período: data desconhecida não é atribuída ao período, mas continua visível", async () => {
    const k: any = await getPlatformFinanceKpis({ from: "2026-01-01", to: "2999-12-31" });
    expect(k.received).toBe(100);
    expect(k.receivedDateUnknown).toBe(80);
    expect(k.receivedIncludesDateUnknown).toBe(false);
  });

  it("listagem de pagamentos: NULLS LAST e flag paidAtUnknown", async () => {
    (SaaSPayment.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 1,
      rows: [{ id: 1, paidAt: null }]
    });
    const r: any = await listPlatformPayments({});
    expect(r.payments[0].paidAtUnknown).toBe(true);
    expect((SaaSPayment.findAndCountAll as jest.Mock).mock.calls[0][0].order[0]).toEqual([
      "paidAt",
      "DESC NULLS LAST"
    ]);
  });
});
