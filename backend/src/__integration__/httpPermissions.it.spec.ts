/**
 * Integração HTTP (supertest) — routers reais + isAuth/isSuper reais + Postgres real.
 * App mínimo (ver helpers/miniApp.ts): app.ts completo exige Redis (Bull) e outros serviços.
 */
// Deve vir ANTES dos routers: express-async-errors só envolve layers criados após o patch
// (em app.ts ele também é o primeiro import).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import companyRoutes from "../routes/companyRoutes";
import saasFinanceRoutes from "../routes/saasFinanceRoutes";
import saasCompanyUsersRoutes from "../routes/saasCompanyUsersRoutes";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  DOMAIN_DATE_RE,
  addMonths,
  assertDisposableDatabase,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  domainDate,
  rawRenewals,
  reloadCompany,
  today
} from "./helpers/fixtures";

const app = buildApp([companyRoutes, saasFinanceRoutes, saasCompanyUsersRoutes]);

describe("HTTP — permissões e fluxos financeiros (Postgres real)", () => {
  let superToken: string;
  let commonToken: string;
  let tenantAdminToken: string;
  let targetCompanyId: number;
  let targetInvoiceId: number;
  let targetUserId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    const superUser = await createUser({ companyId: host.id, superUser: true });
    superToken = tokenFor({ id: superUser.id, profile: "admin", companyId: host.id });

    const target = await createCompany({ dueDate: daysFromToday(-5), status: false });
    targetCompanyId = target.id;
    targetInvoiceId = (await createOpenInvoice(target.id, { value: 100 })).id;
    const common = await createUser({ companyId: target.id, profile: "user" });
    targetUserId = common.id;
    commonToken = tokenFor({ id: common.id, profile: "user", companyId: target.id });
    const tenantAdmin = await createUser({ companyId: target.id, profile: "admin" });
    tenantAdminToken = tokenFor({ id: tenantAdmin.id, profile: "admin", companyId: target.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const protectedCalls = (): Array<[string, string, Record<string, unknown> | undefined]> => [
    ["post", `/companies/${targetCompanyId}/renew`, { reason: "tentativa indevida", expectedCurrentDueDate: null }],
    ["post", `/saas/companies/${targetCompanyId}/finance/manual-payment`, {
      invoiceId: targetInvoiceId, kind: "paid_offline", amount: 100, method: "pix", paidAt: today(), reason: "tentativa indevida"
    }],
    ["get", `/saas/companies/${targetCompanyId}/finance/summary`, undefined],
    ["get", `/saas/companies/${targetCompanyId}/finance/renewal-preview`, undefined],
    ["get", `/saas/companies/${targetCompanyId}/users`, undefined],
    ["post", `/saas/companies/${targetCompanyId}/users`, { name: "X", email: "x@example.test", password: "12345678", profile: "admin" }],
    ["put", `/saas/companies/${targetCompanyId}/users/${targetUserId}`, { name: "Y" }],
    ["patch", `/saas/companies/${targetCompanyId}/users/${targetUserId}/active`, { active: false }],
    ["post", `/saas/companies/${targetCompanyId}/users/${targetUserId}/password`, { password: "novaSenha123" }]
  ];

  describe.each([
    ["usuário comum (profile user)", () => commonToken],
    ["admin do tenant (profile admin, não super)", () => tenantAdminToken]
  ])("%s", (_label, getToken) => {
    const callAll = async (): Promise<Array<{ route: string; status: number; error: unknown }>> => {
      const results: Array<{ route: string; status: number; error: unknown }> = [];
      for (const [method, url, body] of protectedCalls()) {
        const req = (request(app) as any)[method](url).set("Authorization", `Bearer ${getToken()}`);
        const res = body ? await req.send(body) : await req;
        results.push({ route: `${method.toUpperCase()} ${url}`, status: res.status, error: res.body?.error });
      }
      return results;
    };

    it("é recusado (401/403) em todas as rotas Super Admin, sem efeitos colaterais", async () => {
      const results = await callAll();
      expect(results.filter(r => r.status !== 401 && r.status !== 403)).toEqual([]);
      expect((await Invoices.findByPk(targetInvoiceId))?.status).toBe("open");
      expect(await countState(targetCompanyId)).toEqual({ payments: 0, renewals: 0, events: 0 });
    });

    it("recusa com 401 do isSuper (autenticado sem permissão), não por sessão inválida", async () => {
      // Decisão do proprietário (Fase 8.4, D14): manter o contrato atual do isSuper (401 "Acesso não permitido").
      // A mensagem distingue a recusa por permissão de token inválido/sessão expirada (ERR_SESSION_EXPIRED / 403).
      const results = await callAll();
      expect(results).toEqual(
        results.map(r => ({ ...r, status: 401, error: "Acesso não permitido" }))
      );
    });
  });

  it("sem token → 401", async () => {
    const res = await request(app).get(`/saas/companies/${targetCompanyId}/finance/summary`);
    expect(res.status).toBe(401);
  });

  describe("Super Admin", () => {
    it("GET summary → 200", async () => {
      const res = await request(app)
        .get(`/saas/companies/${targetCompanyId}/finance/summary`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(200);
    });

    it("GET renewal-preview → contrato { currentDueDate, recurrence, months, newDueDate, overdue, cyclesSkipped }", async () => {
      const res = await request(app)
        .get(`/saas/companies/${targetCompanyId}/finance/renewal-preview`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          currentDueDate: daysFromToday(-5),
          recurrence: "MENSAL",
          months: 1,
          overdue: true,
          cyclesSkipped: expect.any(Number)
        })
      );
      expect(res.body.newDueDate).toMatch(DOMAIN_DATE_RE);
    });

    it("manual-payment com invoiceId de OUTRA empresa → 404 sem efeitos", async () => {
      const other = await createCompany({ dueDate: daysFromToday(-5) });
      const res = await request(app)
        .post(`/saas/companies/${other.id}/finance/manual-payment`)
        .set("Authorization", `Bearer ${superToken}`)
        .send({ invoiceId: targetInvoiceId, kind: "paid_offline", amount: 100, method: "pix", paidAt: today(), reason: "isolamento" });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("ERR_INVOICE_NOT_FOUND");
      expect((await Invoices.findByPk(targetInvoiceId))?.status).toBe("open");
    });

    it("manual-payment sem campos obrigatórios → 400 (não 500)", async () => {
      const res = await request(app)
        .post(`/saas/companies/${targetCompanyId}/finance/manual-payment`)
        .set("Authorization", `Bearer ${superToken}`)
        .send({ invoiceId: targetInvoiceId, kind: "paid_offline" });
      expect(res.status).toBe(400);
    });

    it("POST /companies/:id/renew (P0 via HTTP, dueDate Date do banco) → 200; repetição com o mesmo expectedCurrentDueDate → 409 ERR_RENEWAL_STALE", async () => {
      const due = daysFromToday(3);
      const company = await createCompany({ dueDate: due, status: true });
      const body = { reason: "Renovação via HTTP", expectedCurrentDueDate: due };

      const r1 = await request(app).post(`/companies/${company.id}/renew`).set("Authorization", `Bearer ${superToken}`).send(body);
      expect({ status: r1.status, error: r1.body?.error, detail: r1.body?.detail }).toEqual({
        status: 200, error: undefined, detail: undefined
      });
      expect(r1.body.id).toBe(company.id);
      expect(r1.body).toHaveProperty("autoUnblocked");
      expect(r1.body).toHaveProperty("renewal");

      const r2 = await request(app).post(`/companies/${company.id}/renew`).set("Authorization", `Bearer ${superToken}`).send(body);
      expect(r2.status).toBe(409);
      expect(r2.body.error).toBe("ERR_RENEWAL_STALE");

      expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(addMonths(due, 1));
      expect(await rawRenewals(company.id)).toHaveLength(1);
    });

    it("POST /companies/:id/renew sem justificativa → 400 ERR_RENEWAL_REASON_REQUIRED", async () => {
      const company = await createCompany({ dueDate: daysFromToday(3) });
      const r = await request(app).post(`/companies/${company.id}/renew`).set("Authorization", `Bearer ${superToken}`)
        .send({ expectedCurrentDueDate: daysFromToday(3) });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("ERR_RENEWAL_REASON_REQUIRED");
    });

    it("manual-payment (P0 via HTTP) → 201 com { payment, invoice, gatewaySyncStatus, renewed, renewalSkippedReason, company }", async () => {
      const due = daysFromToday(-5);
      const company = await createCompany({ dueDate: due, status: false });
      const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due });
      const r = await request(app)
        .post(`/saas/companies/${company.id}/finance/manual-payment`)
        .set("Authorization", `Bearer ${superToken}`)
        .send({ invoiceId: invoice.id, kind: "paid_offline", amount: 100, method: "pix", paidAt: today(), reason: "Pago via HTTP" });
      expect({ status: r.status, error: r.body?.error, detail: r.body?.detail }).toEqual({
        status: 201, error: undefined, detail: undefined
      });
      expect(r.body).toEqual(expect.objectContaining({
        payment: expect.any(Object),
        invoice: expect.objectContaining({ status: "paid" }),
        gatewaySyncStatus: expect.any(String),
        renewed: true,
        renewalSkippedReason: null,
        company: expect.objectContaining({ id: company.id, status: true })
      }));
      expect(r.body.company.dueDate).toMatch(DOMAIN_DATE_RE);

      const again = await request(app)
        .post(`/saas/companies/${company.id}/finance/manual-payment`)
        .set("Authorization", `Bearer ${superToken}`)
        .send({ invoiceId: invoice.id, kind: "paid_offline", amount: 100, method: "pix", paidAt: today(), reason: "Pago via HTTP" });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe("ERR_INVOICE_NOT_OPEN");
      expect(await rawRenewals(company.id)).toHaveLength(1);
    });

    it("adjust-due-date (P0 via HTTP, dueDate Date) → 200 e previousDueDate YYYY-MM-DD", async () => {
      const due = daysFromToday(-5);
      const company = await createCompany({ dueDate: due, status: false });
      const target = daysFromToday(15);
      const r = await request(app)
        .post(`/saas/companies/${company.id}/finance/adjust-due-date`)
        .set("Authorization", `Bearer ${superToken}`)
        .send({ dueDate: target, reason: "Ajuste negociado" });
      expect({ status: r.status, error: r.body?.error, detail: r.body?.detail }).toEqual({
        status: 200, error: undefined, detail: undefined
      });
      expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(target);
      const rows = await rawRenewals(company.id);
      expect(rows[rows.length - 1].previousDueDate).toBe(due);
    });
  });
});
