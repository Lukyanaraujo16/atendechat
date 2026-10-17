const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

const invoiceState: any = {
  id: 10,
  companyId: 5,
  value: 200,
  status: "open",
  externalTxid: "txid-pix-1",
  externalChargeId: null,
  gatewayProvider: "efi",
  update: jest.fn(async function (this: any, data: any) {
    Object.assign(this, data);
  }),
  reload: jest.fn(async function (this: any) {
    return this;
  })
};

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => invoiceState)
  }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (data: any) => ({ id: 77, ...data }))
  }
}));

jest.mock("../../../models/SaaSReconciliationItem", () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (data: any) => ({ id: 1, ...data }))
  }
}));

jest.mock("../applySubscriptionRenewal", () => ({
  runRenewalSideEffects: jest.fn(async () => undefined),
  applySubscriptionRenewal: jest.fn(async () => ({
    alreadyApplied: false,
    company: { id: 5 },
    renewal: {},
    autoUnblocked: false,
    skippedReason: null
  }))
}));

jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => null)
}));

jest.mock("../efiCobrancasClient", () => ({
  settleEfiCobrancasCharge: jest.fn()
}));

jest.mock("../../../config/saasBillingFlags", () => ({
  saasBillingFlags: {
    cobrancasSettleEnabled: () => false
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import { registerManualPayment } from "../registerManualPayment";
import SaaSPayment from "../../../models/SaaSPayment";
import SaaSReconciliationItem from "../../../models/SaaSReconciliationItem";
import { applySubscriptionRenewal } from "../applySubscriptionRenewal";

describe("registerManualPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invoiceState.status = "open";
    invoiceState.gatewayProvider = "efi";
    invoiceState.externalTxid = "txid-pix-1";
    invoiceState.externalChargeId = null;
  });

  it("exige motivo", async () => {
    await expect(
      registerManualPayment({
        invoiceId: 10,
        companyId: 5,
        actorUserId: 1,
        kind: "paid_offline",
        amount: 200,
        method: "pix",
        paidAt: new Date(),
        reason: "  "
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("cortesia não conta como receita e sync Pix fica unsupported", async () => {
    const result = await registerManualPayment({
      invoiceId: 10,
      companyId: 5,
      actorUserId: 99,
      kind: "courtesy",
      amount: 200,
      method: "other",
      paidAt: new Date("2026-10-01T12:00:00Z"),
      reason: "Cortesia comercial aprovada"
    });

    expect(SaaSPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "courtesy",
        countsAsRevenue: false,
        recordedByUserId: 99,
        gatewaySyncStatus: "unsupported"
      }),
      expect.anything()
    );
    expect(result.gatewaySyncStatus).toBe("unsupported");
    expect(SaaSReconciliationItem.create).toHaveBeenCalled();
    expect(applySubscriptionRenewal).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "courtesy" })
    );
  });

  it("baixa offline Pix gera histórico e NÃO marca sync como sucesso Efí", async () => {
    const result = await registerManualPayment({
      invoiceId: 10,
      companyId: 5,
      actorUserId: 2,
      kind: "paid_offline",
      amount: 200,
      method: "transfer",
      paidAt: new Date(),
      reason: "TED comprovada"
    });

    expect(result.gatewaySyncStatus).toBe("unsupported");
    expect(SaaSPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "paid_offline",
        countsAsRevenue: true,
        gatewaySyncStatus: "unsupported"
      }),
      expect.anything()
    );
    expect(invoiceState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        paymentSource: "paid_offline",
        gatewaySyncStatus: "unsupported"
      }),
      expect.anything()
    );
  });

  const base = {
    invoiceId: 10,
    companyId: 5,
    actorUserId: 2,
    kind: "paid_offline" as const,
    method: "pix",
    paidAt: new Date("2026-10-17T12:00:00Z"),
    reason: "Pix recebido na conta"
  };

  it("rejeita pagamento insuficiente sem gravar nada", async () => {
    await expect(
      registerManualPayment({ ...base, amount: 199.99 })
    ).rejects.toMatchObject({ message: "ERR_PAYMENT_AMOUNT_INSUFFICIENT", statusCode: 400 });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(invoiceState.update).not.toHaveBeenCalled();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("rejeita pagamento acima do valor da fatura", async () => {
    await expect(
      registerManualPayment({ ...base, amount: 250 })
    ).rejects.toMatchObject({ message: "ERR_PAYMENT_AMOUNT_EXCEEDS" });
    expect(SaaSPayment.create).not.toHaveBeenCalled();
  });

  it("fatura já paga retorna 409 e não renova de novo", async () => {
    invoiceState.status = "paid";
    await expect(
      registerManualPayment({ ...base, amount: 200 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_OPEN", statusCode: 409 });
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("renova com chave idempotente por fatura e cobertura do ciclo da fatura", async () => {
    (invoiceState as any).dueDate = "2026-10-10";
    const result = await registerManualPayment({ ...base, amount: 200 });
    expect(applySubscriptionRenewal).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "payment_confirmed",
        idempotencyKey: "renew-invoice:10",
        coversInvoiceDueDate: "2026-10-10",
        invoiceId: 10,
        paymentId: 77
      })
    );
    expect(result.renewed).toBe(true);
    expect(result.renewalSkippedReason).toBeNull();
  });

  it("renewSubscription=false não renova", async () => {
    const result = await registerManualPayment({ ...base, amount: 200, renewSubscription: false });
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
    expect(result.renewalSkippedReason).toBe("disabled");
  });
});
