jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    upsert: jest.fn()
  }
}));
jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    bulkCreate: jest.fn()
  }
}));
jest.mock("../../SystemSettingService/GetSystemBillingSettingsService", () => ({
  __esModule: true,
  default: jest.fn()
}));
// Efeitos colaterais que a simulação NUNCA pode disparar.
jest.mock("../../CompanyService/CreateCompanyLogService", () => ({
  createCompanyLog: jest.fn()
}));
jest.mock("../../CompanyService/SendBillingWhatsAppWarningService", () => ({
  trySendBillingWhatsAppWarning: jest.fn()
}));
jest.mock("../../CompanyService/billingAutomationHooks", () => ({
  dispatchBillingAutomationEvent: jest.fn()
}));
jest.mock("../../CompanyService/notifySuperAdminsBilling", () => ({
  notifySuperAdminsBillingAutoBlock: jest.fn(),
  notifySuperAdminsBillingOverdue: jest.fn(),
  notifySuperAdminsBillingWarningBefore: jest.fn(),
  notifySuperAdminsBillingWhatsAppFailed: jest.fn()
}));
jest.mock("../../CompanyService/BillingAutomationJob", () => ({
  runBillingAutomationJob: jest.fn()
}));
// Middlewares: autenticação simulada por cabeçalho (sem banco/JWT).
jest.mock("../../../middleware/isAuth", () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    if (!req.headers["x-test-user"]) {
      const AppErr = jest.requireActual("../../../errors/AppError").default;
      throw new AppErr("ERR_SESSION_EXPIRED", 401);
    }
    req.user = { id: req.headers["x-test-user"] };
    return next();
  }
}));
jest.mock("../../../middleware/isSuper", () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    if (req.headers["x-test-super"] !== "1") {
      const AppErr = jest.requireActual("../../../errors/AppError").default;
      throw new AppErr("Acesso não permitido", 401);
    }
    return next();
  }
}));

import fs from "fs";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import request from "supertest";
import AppError from "../../../errors/AppError";
import Company from "../../../models/Company";
import CompanyLog from "../../../models/CompanyLog";
import GetSystemBillingSettingsService from "../../SystemSettingService/GetSystemBillingSettingsService";
import { createCompanyLog } from "../../CompanyService/CreateCompanyLogService";
import { trySendBillingWhatsAppWarning } from "../../CompanyService/SendBillingWhatsAppWarningService";
import { dispatchBillingAutomationEvent } from "../../CompanyService/billingAutomationHooks";
import * as notify from "../../CompanyService/notifySuperAdminsBilling";
import { runBillingAutomationJob } from "../../CompanyService/BillingAutomationJob";
import {
  listCompaniesBillingStatus,
  simulateBillingAutomation
} from "../BillingSimulationService";
import billingSimulationRoutes from "../../../routes/billingSimulationRoutes";

const ORIGINAL_FLAG = process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
const TODAY = "2026-10-17";

const settings = {
  daysBeforeDueWarning: 3,
  daysAfterDueWarning: 1,
  daysAfterDueBlock: 3,
  enableAutoBlock: true,
  enableAutoWarning: true,
  enableAutoWhatsAppWarning: true,
  whatsappSenderCompanyId: 1
};

/** Meia-noite em SP como o pg devolve timestamptz. */
const spMidnight = (d: string) => new Date(`${d}T03:00:00.000Z`);

const companies = [
  { id: 1, name: "Vencida", status: true, timezone: "America/Sao_Paulo", dueDate: spMidnight("2026-10-07") },
  { id: 2, name: "Carência", status: true, timezone: "America/Sao_Paulo", dueDate: spMidnight("2026-10-16") },
  { id: 3, name: "Aviso antes", status: true, timezone: null, dueDate: "2026-10-20" },
  { id: 4, name: "Sem vencimento", status: true, timezone: null, dueDate: null },
  { id: 5, name: "Manual", status: false, timezone: null, dueDate: spMidnight("2026-12-01") },
  { id: 6, name: "Financeiro", status: false, timezone: null, dueDate: spMidnight("2026-09-01") },
  { id: 7, name: "Desconhecido", status: false, timezone: null, dueDate: null }
];

function expectZeroWrites() {
  expect(Company.update).not.toHaveBeenCalled();
  expect(Company.create).not.toHaveBeenCalled();
  expect(Company.destroy).not.toHaveBeenCalled();
  expect(Company.upsert).not.toHaveBeenCalled();
  expect(CompanyLog.create).not.toHaveBeenCalled();
  expect(CompanyLog.update).not.toHaveBeenCalled();
  expect(CompanyLog.bulkCreate).not.toHaveBeenCalled();
  expect(createCompanyLog).not.toHaveBeenCalled();
  expect(trySendBillingWhatsAppWarning).not.toHaveBeenCalled();
  expect(dispatchBillingAutomationEvent).not.toHaveBeenCalled();
  expect(notify.notifySuperAdminsBillingAutoBlock).not.toHaveBeenCalled();
  expect(notify.notifySuperAdminsBillingOverdue).not.toHaveBeenCalled();
  expect(notify.notifySuperAdminsBillingWarningBefore).not.toHaveBeenCalled();
  expect(notify.notifySuperAdminsBillingWhatsAppFailed).not.toHaveBeenCalled();
  expect(runBillingAutomationJob).not.toHaveBeenCalled();
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(billingSimulationRoutes);
  app.use((err: any, _req: Request, res: Response, _n: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    return res.status(500).json({ error: "ERR_INTERNAL" });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
  (GetSystemBillingSettingsService as jest.Mock).mockResolvedValue({ ...settings });
  (Company.findAll as jest.Mock).mockResolvedValue(companies.map(c => ({ ...c })));
  (CompanyLog.findAll as jest.Mock).mockResolvedValue([
    { companyId: 5, action: "block" },
    { companyId: 6, action: "auto_block" },
    { companyId: 6, action: "block" }
  ]);
});
afterAll(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
  else process.env.BILLING_AUTOMATION_NORMALIZED_DATES = ORIGINAL_FLAG;
});

describe("simulateBillingAutomation", () => {
  it("avalia todas as empresas com as configurações reais e não escreve nada", async () => {
    const r = await simulateBillingAutomation({ today: TODAY });

    expect(r.readOnly).toBe(true);
    expect(r.today).toBe(TODAY);
    expect(r.jobMode).toBe("legacy");
    expect(r.settings).toEqual({
      daysBeforeDueWarning: 3,
      daysAfterDueWarning: 1,
      daysAfterDueBlock: 3,
      enableAutoBlock: true,
      enableAutoWarning: true
    });
    expect(typeof r.generatedAt).toBe("string");
    expect(r.summary).toEqual({
      total: 7,
      wouldBlock: 1,
      inGrace: 1,
      active: 4,
      wouldWarnBeforeDue: 1,
      wouldWarnAfterDue: 1,
      noDueDate: 2,
      blockedManual: 1,
      blockedFinancial: 1,
      blockedUnknown: 1,
      legacyJobWouldSkip: 3 // ativas com Date (1, 2) + sem vencimento (4)
    });

    const byId = new Map(r.companies.map(c => [c.companyId, c]));
    expect(byId.get(1)).toMatchObject({
      name: "Vencida",
      dueDate: "2026-10-07",
      daysLate: 10,
      financialStatus: "vencido",
      wouldBlock: true,
      legacyJobWouldSkip: true
    });
    expect(byId.get(2)).toMatchObject({ financialStatus: "carencia", wouldWarnAfterDue: true });
    expect(byId.get(3)).toMatchObject({ wouldWarnBeforeDue: true, legacyJobWouldSkip: false });
    expect(byId.get(5)!.blockKind).toBe("manual");
    expect(byId.get(6)!.blockKind).toBe("financial");
    expect(byId.get(7)!.blockKind).toBe("unknown");

    // Consultas: 1 settings, 1 empresas, 1 lote de logs (só das bloqueadas).
    expect(GetSystemBillingSettingsService).toHaveBeenCalledTimes(1);
    expect(Company.findAll).toHaveBeenCalledTimes(1);
    expect(CompanyLog.findAll).toHaveBeenCalledTimes(1);
    const where = (CompanyLog.findAll as jest.Mock).mock.calls[0][0].where;
    const sym = Object.getOwnPropertySymbols(where.companyId)[0];
    expect(where.companyId[sym]).toEqual([5, 6, 7]);

    expectZeroWrites();
  });

  it("jobMode reflete a flag do job", async () => {
    process.env.BILLING_AUTOMATION_NORMALIZED_DATES = "1";
    const r = await simulateBillingAutomation({ today: TODAY });
    expect(r.jobMode).toBe("normalized");
    expectZeroWrites();
  });

  it("sem today usa a data atual", async () => {
    const r = await simulateBillingAutomation();
    expect(r.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expectZeroWrites();
  });
});

describe("listCompaniesBillingStatus", () => {
  it("devolve status em lote sem escrever", async () => {
    const r = await listCompaniesBillingStatus();
    expect(r.companies).toHaveLength(7);
    expect(Object.keys(r.companies[0]).sort()).toEqual(
      ["blockKind", "companyId", "daysLate", "dueDate", "financialStatus", "operationalStatus"].sort()
    );
    expect(r.companies.find(c => c.companyId === 5)).toMatchObject({
      operationalStatus: "bloqueada",
      blockKind: "manual"
    });
    expect(Company.findAll).toHaveBeenCalledTimes(1);
    expect(CompanyLog.findAll).toHaveBeenCalledTimes(1);
    expectZeroWrites();
  });

  it("filtra por companyIds", async () => {
    await listCompaniesBillingStatus({ companyIds: [1, 2] });
    const where = (Company.findAll as jest.Mock).mock.calls[0][0].where;
    const sym = Object.getOwnPropertySymbols(where.id)[0];
    expect(where.id[sym]).toEqual([1, 2]);
  });
});

describe("rotas de simulação (isAuth + isSuper)", () => {
  const app = buildApp();
  const asSuper = (r: request.Test) => r.set("x-test-user", "1").set("x-test-super", "1");

  it("GET /saas/billing-automation/simulation → 200 somente leitura", async () => {
    const res = await asSuper(request(app).get(`/saas/billing-automation/simulation?today=${TODAY}`));
    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(true);
    expect(res.body.summary.total).toBe(7);
    expect(res.body.companies[0]).toHaveProperty("name");
    expectZeroWrites();
  });

  it("today inválido → 400 pt-BR", async () => {
    const res = await asSuper(request(app).get("/saas/billing-automation/simulation?today=2026-02-30"));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "ERR_INVALID_DATE",
      message: "Data inválida. Use o formato AAAA-MM-DD."
    });
    expect(Company.findAll).not.toHaveBeenCalled();
  });

  it("GET /saas/companies/billing-status → 200", async () => {
    const res = await asSuper(request(app).get("/saas/companies/billing-status"));
    expect(res.status).toBe(200);
    expect(res.body.companies).toHaveLength(7);
    expectZeroWrites();
  });

  it("companyIds inválido → 400", async () => {
    const res = await asSuper(request(app).get("/saas/companies/billing-status?companyIds=1,abc"));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ERR_INVALID_COMPANY");
  });

  it("não-super → 401 Acesso não permitido, sem consultar empresas", async () => {
    const res = await request(app)
      .get("/saas/billing-automation/simulation")
      .set("x-test-user", "2");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Acesso não permitido");
    const res2 = await request(app).get("/saas/companies/billing-status").set("x-test-user", "2");
    expect(res2.status).toBe(401);
    expect(Company.findAll).not.toHaveBeenCalled();
  });

  it("sem autenticação → 401", async () => {
    const res = await request(app).get("/saas/companies/billing-status");
    expect(res.status).toBe(401);
    expect(Company.findAll).not.toHaveBeenCalled();
  });
});

describe("garantia estática de somente leitura", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(__dirname, rel), "utf8");
  const sources = [
    read("../BillingSimulationService.ts"),
    read("../billingEvaluation.ts"),
    read("../../../controllers/BillingSimulationController.ts")
  ];

  it("não importa o job nem serviços de escrita/notificação/WhatsApp/fila", () => {
    for (const src of sources) {
      const imports = src.split("\n").filter(l => /\bfrom\s+["']|require\(/.test(l)).join("\n");
      expect(imports).not.toMatch(/BillingAutomationJob/);
      expect(imports).not.toMatch(/CreateCompanyLogService/);
      expect(imports).not.toMatch(/notifySuperAdmins/);
      expect(imports).not.toMatch(/WhatsApp|wbot|SendMessage/i);
      expect(imports).not.toMatch(/queue|bull/i);
      expect(imports).not.toMatch(/billingAutomationHooks|recordFinancialEvent/);
      expect(src).not.toMatch(/runBillingAutomationJob/);
    }
  });

  it("não chama métodos de escrita do Sequelize", () => {
    for (const src of sources) {
      expect(src).not.toMatch(/\.(create|update|destroy|upsert|bulkCreate|increment|decrement|save)\(/);
      expect(src).not.toMatch(/sequelize\.query|transaction\(/);
    }
  });
});
