import UpdateInvoiceService from "../UpdateInvoiceService";

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

import Invoice from "../../../models/Invoices";

describe("UpdateInvoiceService", () => {
  it("bloqueia status paid por tenant", async () => {
    await expect(
      UpdateInvoiceService({ id: 1, status: "paid", companyId: 10 })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Invoice.findOne).not.toHaveBeenCalled();
  });

  it("bloqueia status cancelled por tenant", async () => {
    await expect(
      UpdateInvoiceService({ id: 1, status: "cancelled", companyId: 10 })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
