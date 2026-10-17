/**
 * Integração 8.4-F — permissões dos endpoints novos (isAuth + isSuper reais).
 * Contrato mantido (D14): não-super autenticado recebe 401 { error: "Acesso não permitido" }, sem efeitos.
 */
// Deve vir ANTES dos routers (express-async-errors só envolve layers criados após o patch).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import { buildApp, tokenFor } from "./helpers/miniApp";
import { assertDisposableDatabase, createCompany, createUser, daysFromToday, today } from "./helpers/fixtures";
import {
  createLegacyInvoice,
  globalWriteSnapshot,
  optionalRequire,
  requireFeature,
  routerOf
} from "./helpers/f84f";

const subscriptionCenterRoutes = optionalRequire("../../routes/saasSubscriptionRoutes");
const historicalRoutes = optionalRequire("../../routes/saasHistoricalReviewRoutes");
const simulationRoutes = optionalRequire("../../routes/billingSimulationRoutes");
const app = buildApp(
  [routerOf(subscriptionCenterRoutes), routerOf(historicalRoutes), routerOf(simulationRoutes)].filter(Boolean) as any
);

describe("8.4-F — permissões dos endpoints novos (Postgres real)", () => {
  let commonToken: string;
  let tenantAdminToken: string;
  let companyId: number;
  let invoiceId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const target = await createCompany({ dueDate: daysFromToday(-10), status: false });
    companyId = target.id;
    invoiceId = (await createLegacyInvoice(target.id, {})).id;
    const common = await createUser({ companyId: target.id, profile: "user" });
    commonToken = tokenFor({ id: common.id, profile: "user", companyId: target.id });
    const admin = await createUser({ companyId: target.id, profile: "admin" });
    tenantAdminToken = tokenFor({ id: admin.id, profile: "admin", companyId: target.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const calls = (): Array<[string, string, Record<string, unknown> | undefined]> => [
    ["get", `/saas/companies/${companyId}/subscription`, undefined],
    ["get", `/saas/companies/${companyId}/timeline`, undefined],
    ["post", `/saas/companies/${companyId}/finance/manual-payment/preview`, {
      invoiceId, kind: "paid_offline", amount: 100, method: "transfer", paidAt: today(), reason: "tentativa indevida"
    }],
    ["get", `/saas/finance/historical-review`, undefined],
    ["get", `/saas/finance/historical-review/summary`, undefined],
    ["post", `/saas/companies/${companyId}/finance/invoices/${invoiceId}/historical-review/preview`, {
      decision: "improper_cancel", note: "tentativa indevida"
    }],
    ["post", `/saas/companies/${companyId}/finance/invoices/${invoiceId}/historical-review`, {
      decision: "improper_cancel", note: "tentativa indevida"
    }],
    ["get", `/saas/billing-automation/simulation`, undefined],
    ["get", `/saas/companies/billing-status`, undefined]
  ];

  it.each([
    ["usuário comum (profile user)", () => commonToken],
    ["admin do tenant (profile admin, não super)", () => tenantAdminToken]
  ])("%s → 401 \"Acesso não permitido\" em todos os endpoints novos, sem efeitos", async (_l, getToken) => {
    requireFeature(subscriptionCenterRoutes, historicalRoutes, simulationRoutes);
    const before = await globalWriteSnapshot();
    const results: Array<{ route: string; status: number; error: unknown }> = [];
    for (const [method, url, body] of calls()) {
      const req = (request(app) as any)[method](url).set("Authorization", `Bearer ${getToken()}`);
      const res = body ? await req.send(body) : await req;
      results.push({ route: `${method.toUpperCase()} ${url}`, status: res.status, error: res.body?.error });
    }
    expect(results).toEqual(results.map(r => ({ ...r, status: 401, error: "Acesso não permitido" })));
    expect(await globalWriteSnapshot()).toEqual(before);
    const [rows] = await sequelize.query(
      `select count(*)::int as n from "SaaSInvoiceHistoricalReviews" where "invoiceId" = :id`,
      { replacements: { id: invoiceId } }
    );
    expect((rows as any[])[0].n).toBe(0);
  });

  it("sem token → 401 em todos os endpoints novos", async () => {
    requireFeature(subscriptionCenterRoutes, historicalRoutes, simulationRoutes);
    const statuses: Array<[string, number]> = [];
    for (const [method, url, body] of calls()) {
      const req = (request(app) as any)[method](url);
      const res = body ? await req.send(body) : await req;
      statuses.push([url, res.status]);
    }
    expect(statuses.filter(([, s]) => s !== 401)).toEqual([]);
  });
});
