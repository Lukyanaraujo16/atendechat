/**
 * Fase 8.4-F (F4/C6) — planSubscriptionRenewal: prévia e execução usam a MESMA regra.
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

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => companyState) }
}));

jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => null), findAll: jest.fn(async () => []) }
}));

jest.mock("../../../models/Invoices", () => ({
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

import {
  applySubscriptionRenewal,
  planSubscriptionRenewal,
  previewSubscriptionRenewal,
  RenewalReason
} from "../applySubscriptionRenewal";
import RenewCompanyDueDateService from "../../CompanyService/RenewCompanyDueDateService";
import SaaSSubscriptionRenewal from "../../../models/SaaSSubscriptionRenewal";
import CompanyLog from "../../../models/CompanyLog";
import Invoices from "../../../models/Invoices";
import { recordFinancialEvent } from "../recordFinancialEvent";

const tz = "America/Sao_Paulo";
const today = () => moment.tz(tz).startOf("day");
const d = (m: moment.Moment) => m.format("YYYY-MM-DD");
const pgDate = (m: moment.Moment) =>
  moment.tz(d(m), "YYYY-MM-DD", tz).toDate();

const resetCompany = (patch: Record<string, unknown>) => {
  for (const k of Object.keys(companyState)) delete companyState[k];
  Object.assign(companyState, {
    id: 5,
    name: "ACME",
    status: true,
    recurrence: "MENSAL",
    timezone: tz,
    update: jest.fn(async (data: any) => {
      Object.assign(companyState, data);
    }),
    reload: jest.fn(async () => companyState),
    ...patch
  });
};

type Scenario = {
  name: string;
  company: Record<string, unknown>;
  reason: RenewalReason;
  lastBlockAction?: string | null;
  coversInvoiceDueDate?: string;
  explicitDueDate?: string;
};

const scenarios = (): Scenario[] => [
  { name: "em dia, mensal", company: { dueDate: pgDate(today().add(5, "days")) }, reason: "manual_renew" },
  { name: "sem vencimento", company: { dueDate: null }, reason: "manual_renew" },
  {
    name: "vencida há 100 dias (ciclos pulados), trimestral",
    company: { dueDate: pgDate(today().subtract(100, "days")), recurrence: "TRIMESTRAL" },
    reason: "manual_renew"
  },
  {
    name: "pagamento com bloqueio manual (mantém bloqueada)",
    company: { dueDate: pgDate(today().subtract(5, "days")), status: false },
    reason: "payment_confirmed",
    lastBlockAction: "block"
  },
  {
    name: "pagamento com bloqueio automático (reativa)",
    company: { dueDate: pgDate(today().subtract(5, "days")), status: false },
    reason: "payment_confirmed",
    lastBlockAction: "auto_block"
  },
  {
    name: "cortesia com bloqueio desconhecido (reativa)",
    company: { dueDate: pgDate(today().subtract(5, "days")), status: false },
    reason: "courtesy",
    lastBlockAction: null
  },
  {
    name: "renovação administrativa com bloqueio manual (reativa)",
    company: { dueDate: pgDate(today().subtract(5, "days")), status: false },
    reason: "manual_renew",
    lastBlockAction: "block"
  },
  {
    name: "período da fatura já coberto",
    company: { dueDate: pgDate(today().subtract(10, "days").add(1, "months")) },
    reason: "payment_confirmed",
    coversInvoiceDueDate: d(today().subtract(10, "days"))
  },
  {
    name: "período da fatura ainda não coberto",
    company: { dueDate: pgDate(today().subtract(3, "days")) },
    reason: "payment_confirmed",
    coversInvoiceDueDate: d(today().subtract(3, "days"))
  },
  {
    name: "ajuste de vencimento explícito",
    company: { dueDate: pgDate(today().subtract(3, "days")), status: false },
    reason: "due_date_adjustment",
    explicitDueDate: d(today().add(20, "days"))
  }
];

describe("planSubscriptionRenewal = applySubscriptionRenewal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CompanyLog.findOne as jest.Mock).mockResolvedValue(null);
  });

  it.each(scenarios().map(s => [s.name, s] as const))(
    "%s: prévia e execução dão o mesmo resultado",
    async (_name, sc) => {
      resetCompany(sc.company);
      (CompanyLog.findOne as jest.Mock).mockResolvedValue(
        sc.lastBlockAction ? { action: sc.lastBlockAction } : null
      );
      const plan = planSubscriptionRenewal({
        company: { ...companyState },
        reason: sc.reason,
        lastBlockAction: companyState.status === false ? sc.lastBlockAction ?? null : null,
        coversInvoiceDueDate: sc.coversInvoiceDueDate,
        explicitDueDate: sc.explicitDueDate
      });

      const result = await applySubscriptionRenewal({
        companyId: 5,
        reason: sc.reason,
        actorUserId: 1,
        note: "teste",
        expectedCurrentDueDate: plan.previousDueDate,
        coversInvoiceDueDate: sc.coversInvoiceDueDate,
        explicitDueDate: sc.explicitDueDate
      });

      expect(plan.error).toBeNull();
      expect(result.previousDueDate).toBe(plan.previousDueDate);
      expect(result.autoUnblocked).toBe(plan.willUnblock);
      if (plan.action === "period_already_covered") {
        expect(result.skippedReason).toBe("period_already_covered");
        expect(result.renewal).toBeNull();
        expect(companyState.update).not.toHaveBeenCalled();
      } else {
        expect(plan.action).toBe("renew");
        const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
        expect(created.newDueDate).toBe(plan.newDueDate);
        expect(created.monthsAdded).toBe(plan.months);
        expect(companyState.dueDate).toBe(plan.newDueDate);
        const evt = (recordFinancialEvent as jest.Mock).mock.calls.find(
          c => c[0].eventType === `renewal_${sc.reason}`
        )[0];
        expect(evt.payload.cyclesSkipped).toBe(plan.cyclesSkipped);
        expect(evt.payload.unblockSkippedManualBlock).toBe(plan.unblockSkippedManual);
      }
      expect(companyState.status).toBe(
        sc.company.status === false ? plan.willUnblock : true
      );
    }
  );

  it("planner sinaliza alertas de ciclo pulado e bloqueio manual", () => {
    const plan = planSubscriptionRenewal({
      company: { id: 5, dueDate: d(today().subtract(70, "days")), recurrence: "MENSAL", timezone: tz, status: false },
      reason: "payment_confirmed",
      lastBlockAction: "block"
    });
    expect(plan.blockKind).toBe("manual");
    expect(plan.willUnblock).toBe(false);
    expect(plan.unblockSkippedManual).toBe(true);
    expect(plan.alerts.map(a => a.code)).toEqual(
      expect.arrayContaining(["CYCLES_SKIPPED", "MANUAL_BLOCK_KEEPS_BLOCKED"])
    );
  });

  it("planner: expected divergente → stale; recorrência inválida → erro (sem lançar)", () => {
    const plan = planSubscriptionRenewal({
      company: { id: 5, dueDate: "2026-10-20", recurrence: "XPTO", timezone: tz, status: true },
      reason: "manual_renew",
      expectedCurrentDueDate: "2026-09-20"
    });
    expect(plan.stale).toBe(true);
    expect(plan.error).toMatchObject({ code: "ERR_INVALID_RECURRENCE", statusCode: 400 });
  });

  it("planner é determinístico com `today` explícito", () => {
    const plan = planSubscriptionRenewal({
      company: { id: 5, dueDate: "2026-07-05", recurrence: "MENSAL", timezone: tz, status: true },
      reason: "manual_renew",
      today: "2026-10-17"
    });
    expect(plan.newDueDate).toBe("2026-11-05");
    expect(plan.cyclesSkipped).toBe(3);
  });

  it("execução com expected divergente → 409 ERR_RENEWAL_STALE sem escrita", async () => {
    resetCompany({ dueDate: pgDate(today().add(5, "days")) });
    await expect(
      applySubscriptionRenewal({
        companyId: 5,
        reason: "manual_renew",
        expectedCurrentDueDate: d(today())
      })
    ).rejects.toMatchObject({ message: "ERR_RENEWAL_STALE", statusCode: 409 });
    expect(companyState.update).not.toHaveBeenCalled();
    expect(SaaSSubscriptionRenewal.create).not.toHaveBeenCalled();
  });
});

describe("previewSubscriptionRenewal (renewal-preview) — compatível e sem escrita", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CompanyLog.findOne as jest.Mock).mockResolvedValue(null);
  });

  it("mantém campos antigos e adiciona willUnblock, blockKind, alerts; não escreve", async () => {
    resetCompany({ dueDate: pgDate(today().subtract(70, "days")), status: false });
    (CompanyLog.findOne as jest.Mock).mockResolvedValue({ action: "block" });
    (Invoices.count as jest.Mock).mockResolvedValueOnce(2);

    const p = await previewSubscriptionRenewal(5);
    const plan = planSubscriptionRenewal({
      company: { ...companyState },
      reason: "manual_renew",
      lastBlockAction: "block"
    });

    expect(p).toMatchObject({
      currentDueDate: d(today().subtract(70, "days")),
      recurrence: "MENSAL",
      months: 1,
      newDueDate: plan.newDueDate,
      overdue: true,
      cyclesSkipped: plan.cyclesSkipped,
      willUnblock: true,
      blockKind: "manual",
      expectedCurrentDueDate: d(today().subtract(70, "days"))
    });
    expect(p.alerts.map(a => a.code)).toEqual(
      expect.arrayContaining(["CYCLES_SKIPPED", "MANUAL_BLOCK_WILL_BE_LIFTED", "OPEN_INVOICES_NOT_PAID"])
    );
    expect(companyState.update).not.toHaveBeenCalled();
    expect(SaaSSubscriptionRenewal.create).not.toHaveBeenCalled();
    expect(recordFinancialEvent).not.toHaveBeenCalled();

    // A execução com o expected da prévia produz exatamente o novo vencimento previsto.
    const r = await applySubscriptionRenewal({
      companyId: 5,
      reason: "manual_renew",
      note: "ok",
      expectedCurrentDueDate: p.expectedCurrentDueDate
    });
    expect(r.renewal?.newDueDate).toBe(p.newDueDate);
    expect(r.autoUnblocked).toBe(p.willUnblock);
  });
});

describe("Renovação administrativa não registra pagamento", () => {
  beforeEach(() => jest.clearAllMocks());

  it("RenewCompanyDueDateService renova sem fatura/pagamento vinculados", async () => {
    resetCompany({ dueDate: pgDate(today().add(2, "days")) });
    const r = await RenewCompanyDueDateService(5, 1, {
      reason: "Cliente pagou por fora",
      expectedCurrentDueDate: d(today().add(2, "days"))
    });
    expect(r.renewal).toBeTruthy();
    const created = (SaaSSubscriptionRenewal.create as jest.Mock).mock.calls[0][0];
    expect(created).toMatchObject({ reason: "manual_renew", invoiceId: null, paymentId: null });
    const types = (recordFinancialEvent as jest.Mock).mock.calls.map(c => c[0].eventType);
    expect(types).toEqual(["renewal_manual_renew"]);
  });
});
