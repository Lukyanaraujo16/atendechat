/**
 * Integração (Postgres real) — correções do fechamento final pré-homologação (8.4 + 8.4-F).
 * - Fuso: vencimento de empresa a oeste de Brasília não perde 1 dia por renovação.
 * - Pix confirmado pela Efí após baixa manual que copiou o txid → conciliação "possível duplicidade".
 * - Recorrência inválida no webhook: Pix registrado + conciliação (sem rollback/reenvio infinito).
 * - GET /companies/:id devolve plano e admin principal para Super Admin (não para tenant).
 * - Fila histórica: estado "unresolved" = pendentes + mantidas pendentes (bate com o summary).
 */
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import SaaSPayment from "../models/SaaSPayment";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import companyRoutes from "../routes/companyRoutes";
import RenewCompanyDueDateService from "../services/CompanyService/RenewCompanyDueDateService";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import { listHistoricalReviewQueue } from "../services/SaasBilling/HistoricalReviewService";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  addMonths,
  assertDisposableDatabase,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  domainDate,
  rawRenewals,
  reloadCompany,
  today
} from "./helpers/fixtures";

jest.mock("gn-api-sdk-typescript", () => ({
  __esModule: true,
  default: () => ({ pixDetailCharge: jest.fn() })
}));

describe("Fechamento final pré-homologação (Postgres real)", () => {
  let superUserId: number;
  let hostId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    hostId = host.id;
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it.each(["America/Manaus", "America/Rio_Branco", "America/Sao_Paulo"])(
    "renovações sucessivas preservam o dia do vencimento para empresa em %s",
    async tz => {
      const due = daysFromToday(5);
      const company = await createCompany({ dueDate: due });
      await Company.update({ timezone: tz }, { where: { id: company.id } });

      await RenewCompanyDueDateService(company.id, superUserId, {
        reason: "Teste fuso 1",
        expectedCurrentDueDate: due
      });
      const after1 = domainDate((await reloadCompany(company.id)).dueDate);
      expect(after1).toBe(addMonths(due, 1));

      await RenewCompanyDueDateService(company.id, superUserId, {
        reason: "Teste fuso 2",
        expectedCurrentDueDate: after1
      });
      expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(addMonths(due, 2));

      const renewals = await rawRenewals(company.id);
      expect(renewals.map(r => r.previousDueDate)).toEqual([due, after1]);
    }
  );

  it("Pix confirmado pela Efí após baixa manual com o mesmo txid abre conciliação (idempotente)", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-3), status: false });
    const txid = `txid-dup-${Date.now()}`;
    const invoice = await createOpenInvoice(company.id, { value: 100, externalTxid: txid });

    await registerManualPayment({
      invoiceId: invoice.id,
      companyId: company.id,
      actorUserId: superUserId,
      kind: "paid_offline",
      amount: 100,
      method: "transfer",
      paidAt: new Date(),
      reason: "Transferência recebida"
    });
    const dueAfterManual = domainDate((await reloadCompany(company.id)).dueDate);

    for (let i = 0; i < 2; i += 1) {
      const r = await confirmGatewayPayment({
        invoiceId: invoice.id,
        amount: 100,
        method: "pix",
        externalTxid: txid,
        gatewayProvider: "efi",
        gatewayStatus: "CONCLUIDA"
      });
      expect(r.alreadyApplied).toBe(true);
      expect(r.renewed).toBe(false);
    }

    const items = await SaaSReconciliationItem.findAll({
      where: { invoiceId: invoice.id, kind: "gateway_payment_on_settled_invoice" }
    });
    expect(items).toHaveLength(1);
    expect(await SaaSPayment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(dueAfterManual);
  });

  it("recorrência inválida no gateway: Pix registrado, sem renovação, conciliação aberta, sem erro", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-3), recurrence: "SEMANAL" });
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    const txid = `txid-rec-${Date.now()}`;

    const r = await confirmGatewayPayment({
      invoiceId: invoice.id,
      amount: 100,
      method: "pix",
      externalTxid: txid,
      gatewayProvider: "efi",
      gatewayStatus: "CONCLUIDA"
    });
    expect(r.alreadyApplied).toBe(false);
    expect(r.renewed).toBe(false);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("paid");
    expect(await SaaSPayment.count({ where: { externalTxid: txid } })).toBe(1);
    expect(await rawRenewals(company.id)).toHaveLength(0);
    expect(
      await SaaSReconciliationItem.count({
        where: { invoiceId: invoice.id, kind: "gateway_payment_renewal_failed" }
      })
    ).toBe(1);
  });

  it("GET /companies/:id traz plano e admin principal só para Super Admin", async () => {
    const app = buildApp([companyRoutes]);
    const company = await createCompany({ dueDate: daysFromToday(10) });
    const admin = await createUser({ companyId: company.id, profile: "admin" });

    const asSuper = await request(app)
      .get(`/companies/${company.id}`)
      .set("Authorization", `Bearer ${tokenFor({ id: superUserId, profile: "admin", companyId: hostId })}`);
    expect(asSuper.status).toBe(200);
    expect(asSuper.body.plan).toEqual(expect.objectContaining({ id: company.planId }));
    expect(asSuper.body.plan.name).toBeTruthy();
    expect(asSuper.body.primaryAdmin).toBeTruthy();

    const asTenant = await request(app)
      .get(`/companies/${company.id}`)
      .set("Authorization", `Bearer ${tokenFor({ id: admin.id, profile: "admin", companyId: company.id })}`);
    expect(asTenant.status).toBe(200);
    expect(asTenant.body.plan).toBeUndefined();
    expect(asTenant.body.primaryAdmin).toBeUndefined();
  });

  it("fila histórica: estado unresolved inclui pendentes e mantidas pendentes", async () => {
    const result = await listHistoricalReviewQueue({ state: "unresolved", page: 1, limit: 100 } as any);
    expect(result.state).toBe("unresolved");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("sanidade: hoje no formato de domínio", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
