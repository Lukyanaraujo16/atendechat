import moment from "moment-timezone";

const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

const companyState: any = {};

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => companyState) }
}));

jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => null) }
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

import { applySubscriptionRenewal } from "../applySubscriptionRenewal";
import SaaSSubscriptionRenewal from "../../../models/SaaSSubscriptionRenewal";
import CompanyLog from "../../../models/CompanyLog";
import { recordFinancialEvent } from "../recordFinancialEvent";
import { createCompanyLog } from "../../CompanyService/CreateCompanyLogService";

const tz = "America/Sao_Paulo";
const today = () => moment.tz(tz).startOf("day");
/** Simula o que o pg devolve para timestamptz: Date à meia-noite de São Paulo. */
const pgDate = (d: moment.Moment) =>
  moment.tz(d.format("YYYY-MM-DD"), "YYYY-MM-DD", tz).toDate();

const resetCompany = (patch: Record<string, unknown>) => {
  for (const k of Object.keys(companyState)) delete companyState[k];
  Object.assign(companyState, {
    id: 5,
    status: true,
    recurrence: "MENSAL",
    timezone: tz,
    update: jest.fn(async function (this: any, data: any) {
      Object.assign(companyState, data);
    }),
    reload: jest.fn(async () => companyState),
    ...patch
  });
};

describe("applySubscriptionRenewal — regressão P0 (dueDate como Date)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"])(
    "dueDate Date (%s): grava previousDueDate YYYY-MM-DD e desbloqueia",
    async recurrence => {
      const due = today().add(5, "days");
      resetCompany({ dueDate: pgDate(due), status: false, recurrence });

      const result = await applySubscriptionRenewal({
        companyId: 5,
        reason: "manual_renew",
        actorUserId: 1,
        note: "Teste"
      });

      const months = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }[recurrence]!;
      const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
      expect(created.previousDueDate).toBe(due.format("YYYY-MM-DD"));
      expect(created.newDueDate).toBe(due.clone().add(months, "months").format("YYYY-MM-DD"));
      expect(typeof created.previousDueDate).toBe("string");
      expect(created.previousDueDate.length).toBeLessThanOrEqual(16);
      expect(result.autoUnblocked).toBe(true);
      expect(companyState.status).toBe(true);
      expect(createCompanyLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "renew" })
      );
    }
  );

  it("dueDate string ISO legada também é normalizada", async () => {
    const due = today().add(3, "days");
    resetCompany({ dueDate: `${due.format("YYYY-MM-DD")}T00:00:00-03:00` });
    await applySubscriptionRenewal({ companyId: 5, reason: "manual_renew", note: "x" });
    const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
    expect(created.previousDueDate).toBe(due.format("YYYY-MM-DD"));
  });

  it("dueDate null: previousDueDate null e novo vencimento = hoje + período", async () => {
    resetCompany({ dueDate: null });
    await applySubscriptionRenewal({ companyId: 5, reason: "manual_renew", note: "x" });
    const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
    expect(created.previousDueDate).toBeNull();
    expect(created.newDueDate).toBe(today().add(1, "months").format("YYYY-MM-DD"));
  });

  it("vencida: novo vencimento nunca fica no passado", async () => {
    resetCompany({ dueDate: pgDate(today().subtract(70, "days")), status: false });
    await applySubscriptionRenewal({ companyId: 5, reason: "manual_renew", note: "x" });
    const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
    expect(created.newDueDate > today().format("YYYY-MM-DD")).toBe(true);
  });

  it("expectedCurrentDueDate divergente → ERR_RENEWAL_STALE sem alterar nada", async () => {
    const due = today().add(5, "days");
    resetCompany({ dueDate: pgDate(due) });
    await expect(
      applySubscriptionRenewal({
        companyId: 5,
        reason: "manual_renew",
        expectedCurrentDueDate: due.clone().subtract(1, "months").format("YYYY-MM-DD")
      })
    ).rejects.toMatchObject({ message: "ERR_RENEWAL_STALE", statusCode: 409 });
    expect(companyState.update).not.toHaveBeenCalled();
    expect(SaaSSubscriptionRenewal.create).not.toHaveBeenCalled();
  });

  it("expectedCurrentDueDate igual → renova", async () => {
    const due = today().add(5, "days");
    resetCompany({ dueDate: pgDate(due) });
    const r = await applySubscriptionRenewal({
      companyId: 5,
      reason: "manual_renew",
      expectedCurrentDueDate: due.format("YYYY-MM-DD")
    });
    expect(r.renewal).toBeTruthy();
  });

  it("cliente antigo sem expectedCurrentDueDate: renovação recente → ERR_RENEWAL_TOO_SOON", async () => {
    resetCompany({ dueDate: pgDate(today().add(5, "days")) });
    (SaaSSubscriptionRenewal.findOne as jest.Mock).mockResolvedValueOnce({ id: 9 });
    await expect(
      applySubscriptionRenewal({ companyId: 5, reason: "manual_renew" })
    ).rejects.toMatchObject({ message: "ERR_RENEWAL_TOO_SOON" });
  });

  it("idempotencyKey já aplicada → alreadyApplied, sem nova extensão", async () => {
    resetCompany({ dueDate: pgDate(today().add(5, "days")) });
    (SaaSSubscriptionRenewal.findOne as jest.Mock).mockResolvedValueOnce({ id: 3 });
    const r = await applySubscriptionRenewal({
      companyId: 5,
      reason: "payment_confirmed",
      idempotencyKey: "renew-invoice:10"
    });
    expect(r.alreadyApplied).toBe(true);
    expect(companyState.update).not.toHaveBeenCalled();
  });

  it("pagamento de fatura cujo período já está coberto não estende de novo", async () => {
    const invoiceDue = today().subtract(10, "days");
    // Renovação administrativa anterior já levou o vencimento para invoiceDue + 1 mês.
    resetCompany({ dueDate: pgDate(invoiceDue.clone().add(1, "months")) });
    const r = await applySubscriptionRenewal({
      companyId: 5,
      reason: "payment_confirmed",
      idempotencyKey: "renew-invoice:10",
      coversInvoiceDueDate: invoiceDue.format("YYYY-MM-DD")
    });
    expect(r.skippedReason).toBe("period_already_covered");
    expect(r.renewal).toBeNull();
    expect(companyState.update).not.toHaveBeenCalled();
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "renewal_skipped_period_already_covered" })
    );
  });

  it("pagamento NÃO reativa empresa bloqueada manualmente; renovação administrativa reativa", async () => {
    (CompanyLog.findOne as jest.Mock).mockResolvedValue({ action: "block" });

    resetCompany({ dueDate: pgDate(today().subtract(5, "days")), status: false });
    const paid = await applySubscriptionRenewal({ companyId: 5, reason: "payment_confirmed" });
    expect(paid.autoUnblocked).toBe(false);
    expect(companyState.status).toBe(false);

    resetCompany({ dueDate: pgDate(today().subtract(5, "days")), status: false });
    const admin = await applySubscriptionRenewal({ companyId: 5, reason: "manual_renew", note: "ok" });
    expect(admin.autoUnblocked).toBe(true);
    expect(companyState.status).toBe(true);
    (CompanyLog.findOne as jest.Mock).mockResolvedValue(null);
  });

  it("pagamento reativa bloqueio automático (financeiro)", async () => {
    (CompanyLog.findOne as jest.Mock).mockResolvedValueOnce({ action: "auto_block" });
    resetCompany({ dueDate: pgDate(today().subtract(5, "days")), status: false });
    const r = await applySubscriptionRenewal({ companyId: 5, reason: "payment_confirmed" });
    expect(r.autoUnblocked).toBe(true);
  });

  it("ajuste de vencimento exige data YYYY-MM-DD válida", async () => {
    resetCompany({ dueDate: pgDate(today()) });
    await expect(
      applySubscriptionRenewal({
        companyId: 5,
        reason: "due_date_adjustment",
        explicitDueDate: "17/10/2026"
      })
    ).rejects.toMatchObject({ message: "ERR_INVALID_DUE_DATE" });
  });
});
