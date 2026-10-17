/**
 * Fase 8.4-F (F6/F-D5) — Confirmação Efí em fatura já quitada fora do gateway:
 * não renova, não cria receita, abre conciliação "possível duplicidade" idempotente por txid.
 */
const mockTransaction = jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: "UPDATE" } }));

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));

const invoiceState: any = {};
const db: any = { payments: [], recon: [] };

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => invoiceState) }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async (opts: any) => {
      const w = opts.where;
      const rows = db.payments.filter((p: any) =>
        w.externalTxid !== undefined ? p.externalTxid === w.externalTxid : p.invoiceId === w.invoiceId
      );
      return rows[rows.length - 1] || null;
    }),
    create: jest.fn(async (data: any) => {
      const row = { id: 500 + db.payments.length, ...data };
      db.payments.push(row);
      return row;
    })
  }
}));

jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async (opts: any) =>
      db.recon.find(
        (r: any) =>
          r.kind === opts.where.kind &&
          r.invoiceId === opts.where.invoiceId &&
          r.companyId === opts.where.companyId &&
          r.metadata.externalTxid === opts.where.metadata.externalTxid
      ) || null
    ),
    create: jest.fn(async (data: any) => {
      const row = { id: 900 + db.recon.length, ...data };
      db.recon.push(row);
      return row;
    })
  }
}));

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => ({ id: 7 })) }
}));

jest.mock("../applySubscriptionRenewal", () => ({
  runRenewalSideEffects: jest.fn(async () => undefined),
  applySubscriptionRenewal: jest.fn(async () => ({
    alreadyApplied: false,
    company: { id: 7 },
    renewal: {},
    autoUnblocked: false
  }))
}));

jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => null)
}));

jest.mock("../../../config/saasBillingFlags", () => ({
  saasBillingFlags: { autoRenewOnPayment: () => true }
}));

jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import { confirmGatewayPayment, GATEWAY_ON_SETTLED_KIND } from "../confirmGatewayPayment";
import SaaSPayment from "../../../models/SaaSPayment";
import SaaSReconciliationItem from "../../../models/SaaSReconciliationItem";
import { applySubscriptionRenewal } from "../applySubscriptionRenewal";
import { recordFinancialEvent } from "../recordFinancialEvent";
import { logger } from "../../../utils/logger";

function reset(invoice: Record<string, unknown>, payments: any[] = []) {
  for (const k of Object.keys(invoiceState)) delete invoiceState[k];
  Object.assign(invoiceState, {
    id: 42,
    companyId: 7,
    value: 100,
    status: "open",
    externalTxid: null,
    paymentSource: null,
    dueDate: "2026-10-10",
    update: jest.fn(async (data: any) => Object.assign(invoiceState, data)),
    ...invoice
  });
  db.payments = payments;
  db.recon = [];
}

const gw = { invoiceId: 42, amount: 100, method: "pix" as const, externalTxid: "tx-efi-1", gatewayProvider: "efi" };

describe("confirmGatewayPayment — fatura já quitada fora do gateway", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["paid_offline", { externalTxid: null }],
    ["courtesy", { externalTxid: null }],
    ["historical_payment", { externalTxid: null }],
    ["historical_courtesy", { externalTxid: null }]
  ])("paga por %s + txid sem SaaSPayment → conciliação, sem receita, sem renovação", async (source, extra) => {
    reset({ status: "paid", paymentSource: source }, [
      { id: 10, invoiceId: 42, companyId: 7, source, countsAsRevenue: source.includes("payment") || source === "paid_offline", ...extra }
    ]);
    const r = await confirmGatewayPayment(gw);
    expect(r).toMatchObject({ renewed: false, alreadyApplied: true, payment: { id: 10 } });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
    expect(invoiceState.update).not.toHaveBeenCalled();
    expect(SaaSReconciliationItem.create).toHaveBeenCalledTimes(1);
    expect(SaaSReconciliationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 7,
        invoiceId: 42,
        paymentId: 10,
        kind: GATEWAY_ON_SETTLED_KIND,
        status: "pending",
        metadata: expect.objectContaining({
          externalTxid: "tx-efi-1",
          amount: 100,
          settledBySource: source,
          possibleDuplicatePayment: true
        })
      }),
      expect.anything()
    );
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "gateway_payment_on_settled_invoice",
        idempotencyKey: "evt:gw-on-settled:tx-efi-1",
        payload: expect.objectContaining({ countsAsRevenue: false, renewed: false })
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ externalTxid: "tx-efi-1" }),
      "[SaasBilling] gateway_payment_on_settled_invoice"
    );
  });

  it("reenvio do webhook com o mesmo txid não duplica a conciliação", async () => {
    reset({ status: "paid", paymentSource: "paid_offline" }, [
      { id: 10, invoiceId: 42, companyId: 7, source: "paid_offline" }
    ]);
    await confirmGatewayPayment(gw);
    await confirmGatewayPayment(gw);
    await confirmGatewayPayment(gw);
    expect(db.recon).toHaveLength(1);
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("fatura legada paga sem nenhum SaaSPayment → conciliação (payment null), sem receita", async () => {
    reset({ status: "paid", paymentSource: null, externalTxid: "tx-efi-1" });
    const r = await confirmGatewayPayment(gw);
    expect(r).toEqual({ payment: null, renewed: false, alreadyApplied: true });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(db.recon[0].metadata).toMatchObject({ sameTxidAsInvoice: true, existingPaymentId: null });
  });

  it("txid já registrado como pagamento gateway → replay idempotente, sem conciliação", async () => {
    reset({ status: "paid", paymentSource: "gateway", externalTxid: "tx-efi-1" }, [
      { id: 11, invoiceId: 42, companyId: 7, source: "gateway", externalTxid: "tx-efi-1" }
    ]);
    const r = await confirmGatewayPayment(gw);
    expect(r).toMatchObject({ alreadyApplied: true, renewed: false, payment: { id: 11 } });
    expect(SaaSReconciliationItem.create).not.toHaveBeenCalled();
  });

  it("corrida: o mesmo txid commitou enquanto esperava o lock → replay, sem conciliação", async () => {
    reset({ status: "paid", paymentSource: "gateway", externalTxid: "tx-efi-1" });
    // 1ª consulta (antes do lock) não vê; a rechecagem sob lock vê o pagamento recém-commitado.
    (SaaSPayment.findOne as jest.Mock).mockImplementationOnce(async () => null);
    db.payments = [{ id: 12, invoiceId: 42, companyId: 7, source: "gateway", externalTxid: "tx-efi-1" }];
    const r = await confirmGatewayPayment(gw);
    expect(r).toMatchObject({ alreadyApplied: true, payment: { id: 12 } });
    expect(SaaSReconciliationItem.create).not.toHaveBeenCalled();
  });

  it("baixa manual que copiou o txid e a Efí confirmou esse Pix → sem renovação/receita, conciliação 'possível duplicidade'", async () => {
    // Fechamento final (FF-D3): antes só logava; o cliente pagou pelos dois meios e Alex precisa ver.
    reset({ status: "paid", paymentSource: "paid_offline", externalTxid: "tx-efi-1" }, [
      { id: 13, invoiceId: 42, companyId: 7, source: "paid_offline", externalTxid: "tx-efi-1" }
    ]);
    const r = await confirmGatewayPayment(gw);
    expect(r).toMatchObject({ alreadyApplied: true, renewed: false });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(SaaSReconciliationItem.create).toHaveBeenCalledTimes(1);
    expect(SaaSReconciliationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "gateway_payment_on_settled_invoice", paymentId: 13 }),
      expect.anything()
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ source: "paid_offline" }),
      "[SaasBilling] gateway_confirmation_matches_non_gateway_payment"
    );
  });
});

describe("confirmGatewayPayment — fatura aberta (regressão)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pagamento parcial é recusado sem gravar", async () => {
    reset({});
    await expect(confirmGatewayPayment({ ...gw, amount: 99.99 })).rejects.toMatchObject({
      message: "ERR_PAYMENT_AMOUNT_MISMATCH"
    });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("valor exato: receita + renovação única por fatura", async () => {
    reset({});
    const r = await confirmGatewayPayment(gw);
    expect(r.renewed).toBe(true);
    expect(SaaSPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: "gateway", countsAsRevenue: true }),
      expect.anything()
    );
    expect(applySubscriptionRenewal).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "renew-invoice:42", coversInvoiceDueDate: "2026-10-10" })
    );
    expect(SaaSReconciliationItem.create).not.toHaveBeenCalled();
  });
});
