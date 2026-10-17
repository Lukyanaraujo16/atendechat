jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn() }
}));
jest.mock("../../SystemSettingService/GetSystemBillingSettingsService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../CreateCompanyLogService", () => ({
  createCompanyLog: jest.fn(async () => 99)
}));
jest.mock("../BillingAutomationDedupeService", () => ({
  hasCompanyBillingWarningLog: jest.fn(async () => false)
}));
jest.mock("../billingAutomationHooks", () => ({
  dispatchBillingAutomationEvent: jest.fn(async () => undefined)
}));
jest.mock("../notifySuperAdminsBilling", () => ({
  notifySuperAdminsBillingAutoBlock: jest.fn(async () => undefined),
  notifySuperAdminsBillingOverdue: jest.fn(async () => undefined),
  notifySuperAdminsBillingWarningBefore: jest.fn(async () => undefined)
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import moment from "moment-timezone";
import Company from "../../../models/Company";
import GetSystemBillingSettingsService from "../../SystemSettingService/GetSystemBillingSettingsService";
import { createCompanyLog } from "../CreateCompanyLogService";
import { dispatchBillingAutomationEvent } from "../billingAutomationHooks";
import { hasCompanyBillingWarningLog } from "../BillingAutomationDedupeService";
import {
  notifySuperAdminsBillingAutoBlock,
  notifySuperAdminsBillingOverdue,
  notifySuperAdminsBillingWarningBefore
} from "../notifySuperAdminsBilling";
import { runBillingAutomationJob } from "../BillingAutomationJob";

const TZ = "America/Sao_Paulo";
const ORIGINAL_FLAG = process.env.BILLING_AUTOMATION_NORMALIZED_DATES;

/** Defaults reais do sistema (enableAutoBlock = true). */
const defaultSettings = {
  daysBeforeDueWarning: 3,
  daysAfterDueWarning: 1,
  daysAfterDueBlock: 3,
  enableAutoBlock: true,
  enableAutoWarning: true,
  enableAutoWhatsAppWarning: false,
  whatsappSenderCompanyId: 1
};

/** dueDate como o `pg` devolve timestamptz: Date à meia-noite do fuso da empresa. */
function dueAsDate(offsetDays: number): Date {
  return moment.tz(TZ).startOf("day").add(offsetDays, "days").toDate();
}
function dueAsString(offsetDays: number): string {
  return moment.tz(TZ).startOf("day").add(offsetDays, "days").format("YYYY-MM-DD");
}

function company(dueDate: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: "Acme",
    phone: "5511999999999",
    status: true,
    timezone: TZ,
    contractedPlanValue: "100",
    planId: 1,
    plan: { value: "100" },
    dueDate,
    ...extra
  };
}

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
  else process.env.BILLING_AUTOMATION_NORMALIZED_DATES = value;
}

function expectNoSideEffects() {
  expect(Company.update).not.toHaveBeenCalled();
  expect(createCompanyLog).not.toHaveBeenCalled();
  expect(dispatchBillingAutomationEvent).not.toHaveBeenCalled();
  expect(notifySuperAdminsBillingAutoBlock).not.toHaveBeenCalled();
  expect(notifySuperAdminsBillingOverdue).not.toHaveBeenCalled();
  expect(notifySuperAdminsBillingWarningBefore).not.toHaveBeenCalled();
}

describe("BillingAutomationJob — flag BILLING_AUTOMATION_NORMALIZED_DATES", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (GetSystemBillingSettingsService as jest.Mock).mockResolvedValue({
      ...defaultSettings
    });
    (Company.update as jest.Mock).mockResolvedValue([1]);
    (hasCompanyBillingWarningLog as jest.Mock).mockResolvedValue(false);
  });
  afterAll(() => setFlag(ORIGINAL_FLAG));

  it("flag ausente (default) → legacy: Date vencido há 10 dias é IGNORADO (sem update/log)", async () => {
    setFlag(undefined);
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-10))]);
    await runBillingAutomationJob();
    expectNoSideEffects();
  });

  it.each(["false", "0", "", "yes"])(
    "flag=%p → legacy: Date vencido há 10 dias é IGNORADO",
    async v => {
      setFlag(v);
      (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-10))]);
      await runBillingAutomationJob();
      expectNoSideEffects();
    }
  );

  it.each(["true", "1"])(
    "flag=%p → normalized: Date vencido há 10 dias BLOQUEIA (update + auto_block)",
    async v => {
      setFlag(v);
      (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-10))]);
      await runBillingAutomationJob();
      expect(Company.update).toHaveBeenCalledWith(
        { status: false },
        { where: { id: 10, status: true } }
      );
      expect(createCompanyLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 10,
          action: "auto_block",
          userId: null,
          metadata: expect.objectContaining({
            dueDate: dueAsString(-10),
            daysLate: 10,
            kind: "automated"
          })
        })
      );
      expect(notifySuperAdminsBillingAutoBlock).toHaveBeenCalledTimes(1);
    }
  );

  it("legacy: string YYYY-MM-DD vencida continua bloqueando (comportamento atual preservado)", async () => {
    setFlag(undefined);
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsString(-10))]);
    await runBillingAutomationJob();
    expect(Company.update).toHaveBeenCalledTimes(1);
    expect(createCompanyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auto_block",
        metadata: expect.objectContaining({ dueDate: dueAsString(-10), daysLate: 10 })
      })
    );
  });

  it("legacy: string com hora/ISO continua sendo ignorada (comportamento atual)", async () => {
    setFlag(undefined);
    (Company.findAll as jest.Mock).mockResolvedValue([
      company(`${dueAsString(-10)}T03:00:00.000Z`)
    ]);
    await runBillingAutomationJob();
    expectNoSideEffects();
  });

  it("legacy: aviso após vencimento (string) mantém metadata com daysLate", async () => {
    setFlag(undefined);
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsString(-1))]);
    await runBillingAutomationJob();
    expect(createCompanyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "warning_after_due",
        metadata: expect.objectContaining({ daysLate: 1, amountBrl: expect.any(String) })
      })
    );
    expect(Company.update).not.toHaveBeenCalled();
  });

  it("normalized: aviso antes do vencimento com Date, deduplicado por dueDate YYYY-MM-DD", async () => {
    setFlag("true");
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(3))]);
    await runBillingAutomationJob();
    expect(hasCompanyBillingWarningLog).toHaveBeenCalledWith(
      10,
      "warning_before_due",
      dueAsString(3)
    );
    expect(createCompanyLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "warning_before_due",
        metadata: expect.objectContaining({ daysUntilDue: 3 })
      })
    );
    expect(Company.update).not.toHaveBeenCalled();
  });

  it("normalized: aviso já registrado não é repetido", async () => {
    setFlag("true");
    (hasCompanyBillingWarningLog as jest.Mock).mockResolvedValue(true);
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-1))]);
    await runBillingAutomationJob();
    expectNoSideEffects();
  });

  it("normalized: carência (daysAfterDueBlock - 1) não bloqueia", async () => {
    setFlag("true");
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-2))]);
    await runBillingAutomationJob();
    expect(Company.update).not.toHaveBeenCalled();
  });

  it("normalized: enableAutoBlock false não bloqueia", async () => {
    setFlag("true");
    (GetSystemBillingSettingsService as jest.Mock).mockResolvedValue({
      ...defaultSettings,
      enableAutoBlock: false,
      enableAutoWarning: false
    });
    (Company.findAll as jest.Mock).mockResolvedValue([company(dueAsDate(-10))]);
    await runBillingAutomationJob();
    expectNoSideEffects();
  });

  it("normalized: sem vencimento é ignorado", async () => {
    setFlag("true");
    (Company.findAll as jest.Mock).mockResolvedValue([company(null)]);
    await runBillingAutomationJob();
    expectNoSideEffects();
  });

  it("consulta continua restrita a empresas ativas (status: true)", async () => {
    setFlag("true");
    (Company.findAll as jest.Mock).mockResolvedValue([]);
    await runBillingAutomationJob();
    expect((Company.findAll as jest.Mock).mock.calls[0][0].where).toEqual({
      status: true
    });
  });
});
