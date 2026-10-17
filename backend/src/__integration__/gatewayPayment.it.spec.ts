/**
 * Integração (Postgres real) — confirmação de pagamento via gateway / webhook Pix.
 * O SDK Efí/Gerencianet é SEMPRE mockado: nenhuma chamada real ao gateway.
 */
// Deve vir ANTES dos routers: express-async-errors só envolve layers criados após o patch
// (em app.ts ele também é o primeiro import).
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import SaaSPayment from "../models/SaaSPayment";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import subscriptionRoutes from "../routes/subScriptionRoutes";
import { buildApp } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  catchError,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday,
  describeError,
  domainDate,
  rawRenewals,
  reloadCompany,
  today
} from "./helpers/fixtures";

const mockPixDetailCharge = jest.fn();
jest.mock("gn-api-sdk-typescript", () => ({
  __esModule: true,
  default: () => ({ pixDetailCharge: (...args: unknown[]) => mockPixDetailCharge(...args) })
}));

describe("Gateway / webhook Pix (Postgres real, Efí mockada)", () => {
  let superUserId: number;
  const app = buildApp([subscriptionRoutes]);

  beforeAll(async () => {
    await assertDisposableDatabase();
    delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  beforeEach(() => mockPixDetailCharge.mockReset());

  afterAll(async () => {
    await sequelize.close();
  });

  it("confirmGatewayPayment repetido com o mesmo txid → 1 pagamento e 1 renovação", async () => {
    const due = daysFromToday(-3);
    const company = await createCompany({ dueDate: due, status: false });
    const txid = `ittx${Date.now()}a`;
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due, externalTxid: txid });

    const input = { invoiceId: invoice.id, amount: 100, method: "pix" as const, externalTxid: txid, gatewayProvider: "efi" };
    const first: any = await confirmGatewayPayment(input);
    const second: any = await confirmGatewayPayment(input);

    expect(first.alreadyApplied).toBe(false);
    expect(first.renewed).toBe(true);
    expect(second.alreadyApplied).toBe(true);
    expect(second.renewed).toBe(false);

    const state = await countState(company.id);
    expect(state.payments).toBe(1);
    expect(state.renewals).toBe(1);
    const rows = await rawRenewals(company.id);
    expect(rows[0].previousDueDate).toBe(due);
    const after = await reloadCompany(company.id);
    expect(after.status).toBe(true);
    expect((domainDate(after.dueDate) as string) > today()).toBe(true);
  });

  it("confirmGatewayPayment simultâneo (Promise.all) com o mesmo txid → 1 pagamento e 1 renovação", async () => {
    const due = daysFromToday(-3);
    const company = await createCompany({ dueDate: due });
    const txid = `ittx${Date.now()}b`;
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due, externalTxid: txid });
    const input = { invoiceId: invoice.id, amount: 100, method: "pix" as const, externalTxid: txid, gatewayProvider: "efi" };

    const results = await Promise.allSettled([confirmGatewayPayment(input), confirmGatewayPayment(input)]);
    const state = await countState(company.id);
    expect(state.payments).toBe(1);
    expect(state.renewals).toBe(1);
    // Ao menos uma confirmação deve ter sucesso; a outra pode ser "alreadyApplied" ou erro de duplicidade.
    expect(results.some(r => r.status === "fulfilled")).toBe(true);
  });

  it("após baixa manual, confirmação gateway da mesma fatura não renova de novo", async () => {
    const due = daysFromToday(-3);
    const company = await createCompany({ dueDate: due });
    const txid = `ittx${Date.now()}c`;
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due, externalTxid: txid });

    await registerManualPayment({
      invoiceId: invoice.id,
      companyId: company.id,
      actorUserId: superUserId,
      kind: "paid_offline",
      amount: 100,
      method: "transferencia",
      paidAt: new Date(),
      reason: "Recebido por TED",
      renewSubscription: true
    } as any);
    const dueAfterManual = domainDate((await reloadCompany(company.id)).dueDate);

    const res: any = await confirmGatewayPayment({
      invoiceId: invoice.id,
      amount: 100,
      method: "pix",
      externalTxid: txid,
      gatewayProvider: "efi"
    });
    expect(res.renewed).toBe(false);
    expect(res.alreadyApplied).toBe(true);
    expect((await countState(company.id)).renewals).toBe(1);
    expect(domainDate((await reloadCompany(company.id)).dueDate)).toBe(dueAfterManual);
  });

  it("POST /subscription/webhook (Pix CONCLUIDA) com Company.dueDate Date → 200, renova; reenvio do mesmo txid não renova de novo", async () => {
    const due = daysFromToday(-3);
    const company = await createCompany({ dueDate: due, status: false });
    const txid = `ittx${Date.now()}d`;
    const invoice = await createOpenInvoice(company.id, { value: 100, dueDate: due, externalTxid: txid });
    mockPixDetailCharge.mockResolvedValue({
      status: "CONCLUIDA",
      solicitacaoPagador: `#Fatura:${invoice.id}`,
      valor: { original: "100.00" }
    });

    const body = { pix: [{ txid, endToEndId: "E2E-IT" }] };
    const r1 = await request(app).post("/subscription/webhook").send(body);
    expect({ status: r1.status, body: r1.body }).toEqual({ status: 200, body: { ok: true } });
    const r2 = await request(app).post("/subscription/webhook").send(body);
    expect(r2.status).toBe(200);

    expect(mockPixDetailCharge).toHaveBeenCalledWith({ txid });
    const state = await countState(company.id);
    expect(state.payments).toBe(1);
    expect(state.renewals).toBe(1);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("paid");
    const after = await reloadCompany(company.id);
    expect(after.status).toBe(true);
    expect((await rawRenewals(company.id))[0].previousDueDate).toBe(due);
  });

  it("webhook: falha de processamento NÃO é confirmada como 200 (Efí deve reenviar)", async () => {
    // Falha transitória (consulta à Efí indisponível). Recorrência inválida deixou de ser gatilho:
    // desde o fechamento final ela registra o Pix e abre conciliação (ver fechamentoFinal.it.spec.ts).
    const company = await createCompany({ dueDate: daysFromToday(-3) });
    const txid = `ittx${Date.now()}e`;
    const invoice = await createOpenInvoice(company.id, { value: 100, externalTxid: txid });
    mockPixDetailCharge.mockRejectedValue(new Error("ETIMEDOUT consulta Efí"));
    const r = await request(app).post("/subscription/webhook").send({ pix: [{ txid }] });
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("ERR_WEBHOOK_PROCESSING_FAILED");
    // rollback: nada gravado, fatura continua aberta
    expect(await SaaSPayment.count({ where: { invoiceId: invoice.id } })).toBe(0);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("open");
  });

  it("webhook: valor divergente não marca como pago", async () => {
    const company = await createCompany({ dueDate: daysFromToday(-3) });
    const txid = `ittx${Date.now()}f`;
    const invoice = await createOpenInvoice(company.id, { value: 100, externalTxid: txid });
    mockPixDetailCharge.mockResolvedValue({
      status: "CONCLUIDA",
      solicitacaoPagador: `#Fatura:${invoice.id}`,
      valor: { original: "50.00" }
    });
    const r = await request(app).post("/subscription/webhook").send({ pix: [{ txid }] });
    expect(r.status).toBe(200);
    expect((await Invoices.findByPk(invoice.id))?.status).toBe("open");
    expect((await countState(company.id)).renewals).toBe(0);
  });

  it("sanidade: erro inesperado reportado de forma legível", async () => {
    const err = await catchError(confirmGatewayPayment({ invoiceId: 99999999, amount: 1, method: "pix" }));
    expect(describeError(err)).toContain("ERR_INVOICE_NOT_FOUND");
  });
});
