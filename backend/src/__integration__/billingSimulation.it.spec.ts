/**
 * Integração 8.4-F — Simulação de cobrança (C2) somente leitura + job real preservado (flag ausente).
 * Postgres real; dueDate vindo do banco como Date (timestamptz).
 */
// Deve vir ANTES dos routers (express-async-errors só envolve layers criados após o patch).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import GetSystemBillingSettingsService from "../services/SystemSettingService/GetSystemBillingSettingsService";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  createCompany,
  createUser,
  daysFromToday,
  reloadCompany
} from "./helpers/fixtures";
import { addCompanyLog, globalWriteSnapshot, optionalRequire, requireFeature, routerOf } from "./helpers/f84f";

// O job importa o envio de WhatsApp (Baileys/ESM, incompatível com o jest) — substituído por um espião
// que NÃO pode ser chamado (nenhum aviso real é enviado nos testes).
const mockTrySendBillingWhatsAppWarning = jest.fn();
jest.mock("../services/CompanyService/SendBillingWhatsAppWarningService", () => ({
  __esModule: true,
  trySendBillingWhatsAppWarning: (...args: unknown[]) => mockTrySendBillingWhatsAppWarning(...args)
}));

const simulationRoutes = optionalRequire("../../routes/billingSimulationRoutes");
const app = buildApp([routerOf(simulationRoutes)].filter(Boolean) as any);

describe("8.4-F — Simulação de automação de cobrança (Postgres real)", () => {
  let superToken: string;
  let blockAfter: number;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    await assertDisposableDatabase();
    delete process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
    const host = await createCompany({ dueDate: daysFromToday(365) });
    const su = await createUser({ companyId: host.id, superUser: true });
    superToken = tokenFor({ id: su.id, profile: "admin", companyId: host.id });
    const settings = await GetSystemBillingSettingsService();
    blockAfter = settings.daysAfterDueBlock;
    expect(blockAfter).toBeGreaterThanOrEqual(2); // precisamos de uma janela de carência

    ids.wouldBlock = (await createCompany({ dueDate: daysFromToday(-(blockAfter + 7)), status: true })).id;
    ids.grace = (await createCompany({ dueDate: daysFromToday(-1), status: true })).id;
    ids.active = (await createCompany({ dueDate: daysFromToday(30), status: true })).id;
    ids.dueToday = (await createCompany({ dueDate: daysFromToday(0), status: true })).id;
    ids.noDue = (await createCompany({ dueDate: null, status: true })).id;
    ids.manual = (await createCompany({ dueDate: daysFromToday(-(blockAfter + 7)), status: false })).id;
    await addCompanyLog(ids.manual, "block");
    ids.financial = (await createCompany({ dueDate: daysFromToday(-(blockAfter + 7)), status: false })).id;
    await addCompanyLog(ids.financial, "block", `${daysFromToday(-30)}T10:00:00-03:00`);
    await addCompanyLog(ids.financial, "auto_block");
    ids.unknown = (await createCompany({ dueDate: daysFromToday(-2), status: false })).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const get = (url: string) => request(app).get(url).set("Authorization", `Bearer ${superToken}`);

  it("GET /saas/billing-automation/simulation → ZERO escrita (Companies, CompanyLogs, UserNotifications, ledger…)", async () => {
    requireFeature(simulationRoutes);
    const before = await globalWriteSnapshot();
    const res = await get(`/saas/billing-automation/simulation`);
    const res2 = await get(`/saas/billing-automation/simulation?today=${daysFromToday(10)}`);
    expect(res.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(await globalWriteSnapshot()).toEqual(before);
    expect(res.body).toMatchObject({ readOnly: true, jobMode: "legacy" });
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        wouldBlock: expect.any(Number),
        inGrace: expect.any(Number),
        active: expect.any(Number),
        noDueDate: expect.any(Number),
        blockedManual: expect.any(Number),
        blockedFinancial: expect.any(Number),
        blockedUnknown: expect.any(Number)
      })
    );
  });

  it("classificação correta: bloquearia, carência, ativa, vence hoje, sem vencimento, bloqueio manual/financeiro/desconhecido", async () => {
    requireFeature(simulationRoutes);
    const res = await get(`/saas/billing-automation/simulation`);
    expect(res.status).toBe(200);
    const byId = new Map<number, any>(res.body.companies.map((c: any) => [c.companyId, c]));
    const pick = (k: string) => {
      const c = byId.get(ids[k]);
      return c
        ? { financialStatus: c.financialStatus, operationalStatus: c.operationalStatus, blockKind: c.blockKind, wouldBlock: c.wouldBlock, daysLate: c.daysLate }
        : null;
    };
    expect({
      wouldBlock: pick("wouldBlock"),
      grace: pick("grace"),
      active: pick("active"),
      dueToday: pick("dueToday"),
      noDue: pick("noDue"),
      manual: pick("manual"),
      financial: pick("financial"),
      unknown: pick("unknown")
    }).toEqual({
      wouldBlock: { financialStatus: "vencido", operationalStatus: "ativa", blockKind: "none", wouldBlock: true, daysLate: blockAfter + 7 },
      grace: { financialStatus: "carencia", operationalStatus: "ativa", blockKind: "none", wouldBlock: false, daysLate: 1 },
      active: { financialStatus: "em_dia", operationalStatus: "ativa", blockKind: "none", wouldBlock: false, daysLate: byId.get(ids.active)?.daysLate ?? null },
      dueToday: { financialStatus: "vence_hoje", operationalStatus: "ativa", blockKind: "none", wouldBlock: false, daysLate: 0 },
      noDue: { financialStatus: "sem_vencimento", operationalStatus: "ativa", blockKind: "none", wouldBlock: false, daysLate: null },
      manual: { financialStatus: "vencido", operationalStatus: "bloqueada", blockKind: "manual", wouldBlock: false, daysLate: blockAfter + 7 },
      financial: { financialStatus: "vencido", operationalStatus: "bloqueada", blockKind: "financial", wouldBlock: false, daysLate: blockAfter + 7 },
      unknown: { financialStatus: blockAfter > 2 ? "carencia" : "vencido", operationalStatus: "bloqueada", blockKind: "unknown", wouldBlock: false, daysLate: 2 }
    });
    // empresa em dia: daysLate é null ou ≤ 0 (contrato não fixa)
    const active = byId.get(ids.active);
    expect(active.daysLate === null || active.daysLate <= 0).toBe(true);
    expect(active.daysUntilDue).toBe(30);
    expect(typeof byId.get(ids.active).name).toBe("string");
  });

  it("GET /saas/companies/billing-status → lote com o mesmo motor, ZERO escrita", async () => {
    requireFeature(simulationRoutes);
    const before = await globalWriteSnapshot();
    const res = await get(`/saas/companies/billing-status`);
    expect(res.status).toBe(200);
    expect(await globalWriteSnapshot()).toEqual(before);
    const byId = new Map<number, any>(res.body.companies.map((c: any) => [c.companyId, c]));
    expect(byId.get(ids.wouldBlock)).toMatchObject({ financialStatus: "vencido", operationalStatus: "ativa", blockKind: "none" });
    expect(byId.get(ids.manual)).toMatchObject({ operationalStatus: "bloqueada", blockKind: "manual" });
    expect(byId.get(ids.financial)).toMatchObject({ blockKind: "financial" });
    expect(byId.get(ids.noDue)).toMatchObject({ financialStatus: "sem_vencimento", dueDate: null });
    expect(byId.get(ids.active).dueDate).toBe(daysFromToday(30));
  });

  it("job REAL com BILLING_AUTOMATION_NORMALIZED_DATES ausente: NÃO bloqueia empresa com dueDate Date vencida (comportamento atual)", async () => {
    delete process.env.BILLING_AUTOMATION_NORMALIZED_DATES;
    // require tardio: falha de import do job (ex.: dependências externas) fica restrita a este teste.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { runBillingAutomationJob } = require("../services/CompanyService/BillingAutomationJob");
    const before = await globalWriteSnapshot();
    await runBillingAutomationJob();
    const company = await reloadCompany(ids.wouldBlock);
    expect(company.dueDate as unknown).toBeInstanceOf(Date);
    expect(company.status).toBe(true);
    const [rows] = await sequelize.query(
      `select count(*)::int as n from "CompanyLogs" where "companyId" = :id and action in ('auto_block','warning_before_due','warning_after_due')`,
      { replacements: { id: ids.wouldBlock } }
    );
    expect((rows as any[])[0].n).toBe(0);
    expect(mockTrySendBillingWhatsAppWarning).not.toHaveBeenCalled();
    // nenhuma empresa mudou de status, nenhum log/notificação criados
    const after = await globalWriteSnapshot();
    expect({ companies: after.companies, companyLogs: after.companyLogs, userNotifications: after.userNotifications }).toEqual({
      companies: before.companies,
      companyLogs: before.companyLogs,
      userNotifications: before.userNotifications
    });
  });
});
