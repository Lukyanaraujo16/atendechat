import fs from "fs";
import path from "path";
import Contact from "../../../models/Contact";
import User from "../../../models/User";
import InventorySale from "../../../models/InventorySale";
import InventorySaleItem from "../../../models/InventorySaleItem";
import InventorySaleItemIdentifier from "../../../models/InventorySaleItemIdentifier";
import InventoryProduct from "../../../models/InventoryProduct";
import InventoryStockMovement from "../../../models/InventoryStockMovement";
import sequelize from "../../../database";
import UpdateInventorySaleService from "../UpdateInventorySaleService";
import CompleteInventorySaleService from "../CompleteInventorySaleService";

jest.mock("../GetOrCreateInventorySettingsService", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ id: 1, nextSaleNumber: 10 })
}));

function draftSale(overrides: Record<string, unknown> = {}) {
  const sale: any = {
    id: 9,
    companyId: 4,
    status: "draft",
    contactId: 1,
    ticketId: null,
    sellerUserId: 2,
    notes: "antiga",
    paymentMethod: "pix",
    paymentNotes: "nota financeira",
    paymentStatus: "unpaid",
    paidAmount: 0,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    }),
    reload: jest.fn(async () => sale)
  };
  Object.assign(sale, overrides);
  return sale;
}

describe("UpdateInventorySaleService cabeçalho", () => {
  const findSale = jest.spyOn(InventorySale, "findOne");
  const findContact = jest.spyOn(Contact, "findOne");
  const findUser = jest.spyOn(User, "findOne");

  beforeEach(() => {
    findSale.mockReset();
    findContact.mockReset();
    findUser.mockReset();
    findContact.mockResolvedValue({ id: 5, companyId: 4 } as never);
    findUser.mockResolvedValue({ id: 3, companyId: 4 } as never);
  });

  afterAll(() => {
    findSale.mockRestore();
    findContact.mockRestore();
    findUser.mockRestore();
  });

  it("grava cliente, vendedor e observação sem campos financeiros", async () => {
    const sale = draftSale();
    findSale.mockResolvedValue(sale);

    await UpdateInventorySaleService({
      companyId: 4,
      id: 9,
      body: {
        contactId: 5,
        sellerUserId: 3,
        notes: "  balcão  ",
        paymentMethod: "cash",
        paymentNotes: "não pode",
        paymentStatus: "paid",
        paidAmount: 10,
        companyId: 99
      } as any
    });

    expect(sale.update).toHaveBeenCalledTimes(1);
    const patch = sale.update.mock.calls[0][0];
    expect(patch).toEqual({
      contactId: 5,
      sellerUserId: 3,
      notes: "balcão"
    });
    expect(patch).not.toHaveProperty("paymentMethod");
    expect(patch).not.toHaveProperty("paymentNotes");
    expect(patch).not.toHaveProperty("paymentStatus");
    expect(patch).not.toHaveProperty("paidAmount");
    expect(patch).not.toHaveProperty("companyId");
    expect(sale.paymentMethod).toBe("pix");
    expect(findSale.mock.calls[0][0]).toMatchObject({
      where: { id: 9, companyId: 4 }
    });
    expect(findContact).toHaveBeenCalledWith({
      where: { id: 5, companyId: 4 }
    });
    expect(findUser).toHaveBeenCalledWith({ where: { id: 3, companyId: 4 } });
  });

  it("update parcial não apaga campos omitidos e aceita cliente nulo", async () => {
    const sale = draftSale();
    findSale.mockResolvedValue(sale);

    await UpdateInventorySaleService({
      companyId: 4,
      id: 9,
      body: { notes: "só a nota" }
    });
    expect(sale.update.mock.calls[0][0]).toEqual({ notes: "só a nota" });
    expect(sale.contactId).toBe(1);
    expect(sale.sellerUserId).toBe(2);

    sale.update.mockClear();
    findContact.mockClear();
    await UpdateInventorySaleService({
      companyId: 4,
      id: 9,
      body: { contactId: null }
    });
    expect(sale.update.mock.calls[0][0]).toEqual({ contactId: null });
    expect(findContact).not.toHaveBeenCalled();
    expect(sale.notes).toBe("só a nota");
    expect(sale.sellerUserId).toBe(2);
  });

  it("recusa contato e vendedor de outra empresa", async () => {
    const sale = draftSale();
    findSale.mockResolvedValue(sale);
    findContact.mockResolvedValue(null);

    await expect(
      UpdateInventorySaleService({
        companyId: 4,
        id: 9,
        body: { contactId: 50 }
      })
    ).rejects.toMatchObject({
      message: "ERR_NO_CONTACT_FOUND",
      statusCode: 404
    });
    expect(sale.update).not.toHaveBeenCalled();

    findContact.mockResolvedValue({ id: 5, companyId: 4 } as never);
    findUser.mockResolvedValue(null);
    await expect(
      UpdateInventorySaleService({
        companyId: 4,
        id: 9,
        body: { sellerUserId: 80 }
      })
    ).rejects.toMatchObject({ message: "ERR_NO_USER_FOUND", statusCode: 404 });
    expect(sale.update).not.toHaveBeenCalled();
  });
});

describe("rotas de venda e busca de cliente", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "../../../routes/inventoryRoutes.ts"),
    "utf8"
  );

  it("a busca de clientes exige view e não usa a rota de atendimento", () => {
    const block = routes.slice(
      routes.indexOf('"/inventory/customers/search"') - 80,
      routes.indexOf('"/inventory/customers/search"') + 220
    );
    expect(block).toContain("INVENTORY_SALES_VIEW");
    expect(block).not.toContain("attendance.inbox");
  });

  it("o update geral exige createSale e o pagamento exige managePayments", () => {
    const updateAt = routes.indexOf(
      'inventoryRoutes.put(\n  "/inventory/sales/:id"'
    );
    const paymentAt = routes.indexOf('"/inventory/sales/:id/payment"');
    expect(updateAt).toBeGreaterThan(-1);
    expect(paymentAt).toBeGreaterThan(updateAt);
    const updateBlock = routes.slice(updateAt, updateAt + 280);
    const paymentBlock = routes.slice(paymentAt - 180, paymentAt + 180);
    expect(updateBlock).toContain("INVENTORY_SALES_CREATE_SALE");
    expect(updateBlock).not.toContain("INVENTORY_SALES_MANAGE_PAYMENTS");
    expect(paymentBlock).toContain("INVENTORY_SALES_MANAGE_PAYMENTS");
  });
});

describe("CompleteInventorySaleService regras iniciais", () => {
  const countMovements = jest.spyOn(InventoryStockMovement, "count");
  const findItems = jest.spyOn(InventorySaleItem, "findAll");
  const findIdentifiers = jest.spyOn(InventorySaleItemIdentifier, "findAll");
  const countIdentifiers = jest.spyOn(InventorySaleItemIdentifier, "count");
  const findProduct = jest.spyOn(InventoryProduct, "findOne");
  const createMovement = jest.spyOn(InventoryStockMovement, "create");

  beforeEach(() => {
    countMovements.mockReset();
    findItems.mockReset();
    findIdentifiers.mockReset();
    countIdentifiers.mockReset();
    findProduct.mockReset();
    createMovement.mockReset();
    countMovements.mockResolvedValue(0 as never);
    findIdentifiers.mockResolvedValue([] as never);
    countIdentifiers.mockResolvedValue(0 as never);
    jest
      .spyOn(sequelize, "transaction")
      .mockImplementation(((fn: any) =>
        fn({ LOCK: { UPDATE: "UPDATE" } })) as any);
  });

  afterEach(() => {
    const transaction = sequelize.transaction as jest.Mock & {
      mockRestore?: () => void;
    };
    if (typeof transaction.mockRestore === "function") {
      transaction.mockRestore();
    }
  });

  it("não conclui sem item e não mexe no estoque", async () => {
    jest
      .spyOn(InventorySale, "findOne")
      .mockResolvedValue(draftSale({ sellerUserId: 3 }) as never);
    findItems.mockResolvedValue([] as never);

    await expect(
      CompleteInventorySaleService({
        companyId: 4,
        saleId: 9,
        sellerUserId: 3,
        completedBy: 3
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_NO_ITEMS" });

    expect(findProduct).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });

  it("não conclui sem vendedor e não mexe no estoque", async () => {
    jest
      .spyOn(InventorySale, "findOne")
      .mockResolvedValue(draftSale({ sellerUserId: null }) as never);
    findItems.mockResolvedValue([
      { id: 1, companyId: 4, quantity: 1 }
    ] as never);
    findIdentifiers.mockResolvedValue([
      { companyId: 4, saleItemId: 1, position: 1, identifier: "SN-1" }
    ] as never);

    await expect(
      CompleteInventorySaleService({
        companyId: 4,
        saleId: 9,
        completedBy: 3
      })
    ).rejects.toMatchObject({
      message: "ERR_VALIDATION_ERROR",
      statusCode: 400
    });

    expect(findProduct).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });
});
