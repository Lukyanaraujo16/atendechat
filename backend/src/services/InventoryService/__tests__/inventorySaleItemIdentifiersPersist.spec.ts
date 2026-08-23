import { Transaction } from "sequelize";
import InventorySaleItemIdentifier from "../../../models/InventorySaleItemIdentifier";
import { replaceSaleItemIdentifiers } from "../inventorySaleItemIdentifiers";

jest.mock("../../../models/InventorySaleItemIdentifier", () => ({
  __esModule: true,
  default: {
    destroy: jest.fn(),
    bulkCreate: jest.fn()
  }
}));

describe("replaceSaleItemIdentifiers — persistência", () => {
  const destroy = InventorySaleItemIdentifier.destroy as jest.Mock;
  const bulkCreate = InventorySaleItemIdentifier.bulkCreate as jest.Mock;

  beforeEach(() => {
    destroy.mockResolvedValue(1);
    bulkCreate.mockResolvedValue([]);
  });

  it("destroy e create sempre restringidos à company do item", async () => {
    const transaction = {} as Transaction;
    await replaceSaleItemIdentifiers({
      companyId: 77,
      saleItemId: 9,
      identifiers: [{ position: 1, identifier: "SN1" }],
      transaction
    });

    expect(destroy).toHaveBeenCalledWith({
      where: { saleItemId: 9, companyId: 77 },
      transaction
    });
    expect(bulkCreate).toHaveBeenCalledWith(
      [
        {
          companyId: 77,
          saleItemId: 9,
          position: 1,
          identifier: "SN1"
        }
      ],
      { transaction }
    );
  });

  it("não cria linhas quando a lista fica vazia", async () => {
    await replaceSaleItemIdentifiers({
      companyId: 1,
      saleItemId: 2,
      identifiers: [],
      transaction: {} as Transaction
    });
    expect(destroy).toHaveBeenCalled();
    expect(bulkCreate).not.toHaveBeenCalled();
  });
});
