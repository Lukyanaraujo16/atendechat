const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));

jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => null)
}));

import Invoices from "../../../models/Invoices";
import SaaSPayment from "../../../models/SaaSPayment";
import { recordFinancialEvent } from "../recordFinancialEvent";
import { cancelSaasInvoice } from "../cancelSaasInvoice";

function makeInvoice(overrides: Record<string, unknown> = {}) {
  const inv: any = {
    id: 10,
    companyId: 5,
    status: "open",
    cancelledAt: null,
    externalTxid: null,
    externalChargeId: null,
    ...overrides
  };
  inv.update = jest.fn(async (data: any) => Object.assign(inv, data));
  inv.reload = jest.fn(async () => inv);
  inv.destroy = jest.fn();
  return inv;
}

const base = { invoiceId: 10, companyId: 5, actorUserId: 1, reason: "Lançada em duplicidade" };

describe("cancelSaasInvoice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SaaSPayment.count as jest.Mock).mockResolvedValue(0);
  });

  it("exige motivo", async () => {
    await expect(cancelSaasInvoice({ ...base, reason: "  " })).rejects.toMatchObject({
      message: "ERR_CANCEL_REASON_REQUIRED",
      statusCode: 400
    });
  });

  it("cancela (soft) com lock, cancelledAt e ledger before/after", async () => {
    const inv = makeInvoice();
    (Invoices.findOne as jest.Mock).mockResolvedValueOnce(inv);
    await cancelSaasInvoice(base);

    expect((Invoices.findOne as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 10, companyId: 5 },
      lock: "UPDATE"
    });
    expect(inv.status).toBe("cancelled");
    expect(inv.cancelledAt).toBeInstanceOf(Date);
    expect(inv.destroy).not.toHaveBeenCalled();
    expect(recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invoice_cancelled",
        payload: expect.objectContaining({
          reason: "Lançada em duplicidade",
          before: { status: "open", cancelledAt: null },
          after: expect.objectContaining({ status: "cancelled" })
        })
      })
    );
  });

  it("não cancela fatura paga", async () => {
    (Invoices.findOne as jest.Mock).mockResolvedValueOnce(makeInvoice({ status: "paid" }));
    await expect(cancelSaasInvoice(base)).rejects.toMatchObject({
      message: "ERR_CANNOT_CANCEL_PAID_INVOICE"
    });
  });

  it("não cancela fatura com pagamento registrado", async () => {
    (Invoices.findOne as jest.Mock).mockResolvedValueOnce(makeInvoice());
    (SaaSPayment.count as jest.Mock).mockResolvedValueOnce(1);
    await expect(cancelSaasInvoice(base)).rejects.toMatchObject({
      message: "ERR_CANNOT_CANCEL_INVOICE_WITH_PAYMENT",
      statusCode: 409
    });
    expect(recordFinancialEvent).not.toHaveBeenCalled();
  });

  it("fatura já cancelada é idempotente (sem novo ledger)", async () => {
    (Invoices.findOne as jest.Mock).mockResolvedValueOnce(makeInvoice({ status: "cancelled" }));
    await cancelSaasInvoice(base);
    expect(recordFinancialEvent).not.toHaveBeenCalled();
  });
});
