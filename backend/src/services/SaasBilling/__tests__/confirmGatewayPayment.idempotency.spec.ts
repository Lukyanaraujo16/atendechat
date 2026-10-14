/**
 * Testes de idempotência do pagamento gateway com mocks de modelos.
 */
const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));

const invoiceState: any = {
  id: 42,
  companyId: 7,
  value: 100,
  status: "open",
  externalTxid: null,
  update: jest.fn(async function (this: any, data: any) {
    Object.assign(this, data);
  })
};

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(async () => invoiceState)
  }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (data: any) => ({ id: 1, ...data }))
  }
}));

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => ({ id: 7 })) }
}));

jest.mock("../applySubscriptionRenewal", () => ({
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
  saasBillingFlags: {
    autoRenewOnPayment: () => true
  }
}));

import { confirmGatewayPayment } from "../confirmGatewayPayment";
import SaaSPayment from "../../../models/SaaSPayment";
import { applySubscriptionRenewal } from "../applySubscriptionRenewal";

describe("confirmGatewayPayment idempotency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invoiceState.status = "open";
    invoiceState.externalTxid = null;
    (SaaSPayment.findOne as jest.Mock).mockResolvedValue(null);
  });

  it("cria pagamento e renova uma vez", async () => {
    const result = await confirmGatewayPayment({
      invoiceId: 42,
      amount: 100,
      method: "pix",
      externalTxid: "txid-abc"
    });
    expect(result.alreadyApplied).toBe(false);
    expect(SaaSPayment.create).toHaveBeenCalled();
    expect(applySubscriptionRenewal).toHaveBeenCalled();
  });

  it("replay com mesmo txid não duplica", async () => {
    (SaaSPayment.findOne as jest.Mock).mockResolvedValue({
      id: 99,
      companyId: 7,
      externalTxid: "txid-abc"
    });
    const result = await confirmGatewayPayment({
      invoiceId: 42,
      amount: 100,
      method: "pix",
      externalTxid: "txid-abc"
    });
    expect(result.alreadyApplied).toBe(true);
    expect(SaaSPayment.create).not.toHaveBeenCalled();
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("rejeita valor divergente", async () => {
    await expect(
      confirmGatewayPayment({
        invoiceId: 42,
        amount: 50,
        method: "pix",
        externalTxid: "txid-x"
      })
    ).rejects.toMatchObject({ message: expect.stringMatching(/AMOUNT|mismatch|ERR_/i) });
  });
});
