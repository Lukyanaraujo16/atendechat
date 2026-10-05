import { Op, Sequelize, UniqueConstraintError } from "sequelize";
import InventoryProduct from "../../../models/InventoryProduct";
import AppError from "../../../errors/AppError";
import { INVENTORY_BARCODE_INDEX } from "../../../helpers/inventoryBarcodeSchema";
import CreateInventoryProductService from "../CreateInventoryProductService";
import UpdateInventoryProductService from "../UpdateInventoryProductService";
import {
  inventoryBarcodeWhere,
  rethrowInventoryBarcodeConstraint
} from "../inventoryBarcode";
import ListInventoryProductsService from "../ListInventoryProductsService";

const duplicate = {
  message: "ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE",
  statusCode: 400
};
const constraintError = (dialect = "postgres", key = INVENTORY_BARCODE_INDEX) =>
  new UniqueConstraintError({
    parent: Object.assign(
      new Error("SQL must never reach user"),
      dialect === "postgres"
        ? { constraint: key }
        : {
            sqlMessage: `Duplicate entry '7-00123' for key 'InventoryProducts.${key}'`
          }
    )
  });

const createProduct = (barcode?: unknown, companyId = 7) =>
  CreateInventoryProductService({
    companyId,
    body: { name: "Produto", salePrice: 10, barcode }
  });

describe("barcode CRUD", () => {
  const findOne = jest.spyOn(InventoryProduct, "findOne");
  const create = jest.spyOn(InventoryProduct, "create");
  beforeEach(() => {
    findOne.mockReset().mockResolvedValue(null);
    create.mockReset().mockResolvedValue({ id: 1 } as never);
  });
  afterAll(() => {
    findOne.mockRestore();
    create.mockRestore();
  });

  it.each([undefined, null, "", " \t\n\u00a0 "])(
    "permite vários produtos sem barcode (%p)",
    async value => {
      await createProduct(value);
      await createProduct(value);
      expect(findOne).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(2);
      expect(create).toHaveBeenLastCalledWith(
        expect.objectContaining({ barcode: null })
      );
    }
  );

  it.each([
    ["0012345678905", "0012345678905"],
    [" \tABC-12  3\u00a0", "ABC-12  3"],
    ["ÁbC123", "ÁbC123"],
    ["abc123", "abc123"],
    ["A".repeat(64), "A".repeat(64)]
  ])("preserva identidade sem restringir EAN: %p", async (input, expected) => {
    await createProduct(input);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: expected })
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { companyId: 7, barcode: expected },
      attributes: ["id"]
    });
  });

  it("rejeita mais de 64 caracteres sem truncar", async () => {
    await expect(createProduct("0".repeat(65))).rejects.toBeInstanceOf(
      AppError
    );
    expect(create).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "reserva barcode de produto active=%p",
    async active => {
      findOne.mockResolvedValue({ id: 8, companyId: 7, active } as never);
      await expect(createProduct("00123")).rejects.toMatchObject(duplicate);
      expect(findOne.mock.calls[0][0].where).toEqual({
        companyId: 7,
        barcode: "00123"
      });
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("permite o mesmo código em outra empresa e ignora tenant enviado no body", async () => {
    findOne.mockImplementation((async options =>
      options.where.companyId === 7 ? { id: 1 } : null) as never);
    await expect(createProduct("00123", 7)).rejects.toMatchObject(duplicate);
    await createProduct("00123", 8);
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ companyId: 8, barcode: "00123" })
    );
    await CreateInventoryProductService({
      companyId: 8,
      body: { name: "P", salePrice: 1, barcode: "X", companyId: 7 } as never
    });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ companyId: 8 })
    );
  });

  it.each(["00123", " \t00123 ", "", null, undefined])(
    "edição preserva próprio código, normaliza ou remove explicitamente: %p",
    async barcode => {
      const product = {
        id: 4,
        companyId: 7,
        barcode: "00123",
        update: jest.fn(),
        reload: jest.fn()
      };
      findOne.mockResolvedValueOnce(product as never).mockResolvedValue(null);
      await UpdateInventoryProductService({
        companyId: 7,
        id: 4,
        body: { barcode }
      });
      expect(findOne).toHaveBeenNthCalledWith(1, {
        where: { id: 4, companyId: 7 }
      });
      if (barcode) {
        expect(findOne).toHaveBeenNthCalledWith(2, {
          where: { companyId: 7, barcode: "00123", id: { [Op.ne]: 4 } },
          attributes: ["id"]
        });
      }
      if (barcode !== undefined)
        expect(product.update).toHaveBeenCalledWith({
          barcode: barcode ? "00123" : null
        });
      else expect(product.update).not.toHaveBeenCalled();
    }
  );

  it("rejeita alteração para outro produto e não edita tenant alheio", async () => {
    const product = { id: 4, update: jest.fn() };
    findOne
      .mockResolvedValueOnce(product as never)
      .mockResolvedValueOnce({ id: 5 } as never);
    await expect(
      UpdateInventoryProductService({
        companyId: 7,
        id: 4,
        body: { barcode: "other" }
      })
    ).rejects.toMatchObject(duplicate);
    expect(product.update).not.toHaveBeenCalled();
    findOne.mockResolvedValue(null);
    await expect(
      UpdateInventoryProductService({
        companyId: 8,
        id: 4,
        body: { barcode: "other" }
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_PRODUCT_NOT_FOUND" });
  });

  it.each(["postgres", "mysql", "mariadb"])(
    "traduz constraint no create e update: %s",
    async dialect => {
      create.mockRejectedValue(constraintError(dialect));
      await expect(createProduct("00123")).rejects.toMatchObject(duplicate);
      const product = {
        id: 4,
        update: jest.fn().mockRejectedValue(constraintError(dialect))
      };
      findOne.mockResolvedValueOnce(product as never).mockResolvedValue(null);
      await expect(
        UpdateInventoryProductService({
          companyId: 7,
          id: 4,
          body: { barcode: "00123" }
        })
      ).rejects.toMatchObject(duplicate);
    }
  );

  it("duas checagens passam; constraint simulada permite somente um save", async () => {
    let saved = false;
    create.mockImplementation((async () => {
      if (saved) throw constraintError();
      saved = true;
      return { id: 1 };
    }) as never);
    const results = await Promise.allSettled([
      createProduct("00123"),
      createProduct("00123")
    ]);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({
      reason: duplicate
    });
  });

  it("não mascara outras constraints, mesmo com nome do índice no valor duplicado", async () => {
    const errors = [
      new Error("connection"),
      constraintError("postgres", "other"),
      constraintError("mysql", "other"),
      new UniqueConstraintError({
        parent: Object.assign(new Error(), {
          sqlMessage: `Duplicate entry '${INVENTORY_BARCODE_INDEX}' for key 'other'`
        })
      })
    ];
    errors.forEach(error => {
      expect(() => rethrowInventoryBarcodeConstraint(error)).toThrow(error);
    });
    create.mockRejectedValue(errors[0]);
    await expect(createProduct("00123")).rejects.toBe(errors[0]);
  });
});

describe("SQL exato coincide com o índice", () => {
  it.each(["postgres", "mysql"])(
    "gera igualdade indexável sem folding: %s",
    dialect => {
      const getDialect = jest
        .spyOn(InventoryProduct.sequelize, "getDialect")
        .mockReturnValue(dialect as never);
      const db = new Sequelize({ dialect: dialect as never, logging: false });
      try {
        const { QueryGenerator: queryGenerator } =
          db.getQueryInterface() as unknown as {
            QueryGenerator: { selectQuery: (...args: unknown[]) => string };
          };
        const sql = queryGenerator.selectQuery(
          "InventoryProducts",
          { where: { companyId: 7, ...inventoryBarcodeWhere("00ÁbC'123") } },
          InventoryProduct
        );
        expect(sql).toContain("companyId");
        expect(sql).toContain("00ÁbC");
        expect(sql).not.toMatch(/LOWER|TRANSLATE|LIKE/i);
        if (dialect === "postgres")
          expect(sql).toContain('"InventoryProduct"."barcode" COLLATE "C"');
        else expect(sql).toContain("`InventoryProduct`.`barcode` =");
      } finally {
        getDialect.mockRestore();
      }
    }
  );

  it("Postgres preserva lowStock, tenant e prioridade ao usar COLLATE C", async () => {
    const dialect = jest
      .spyOn(InventoryProduct.sequelize, "getDialect")
      .mockReturnValue("postgres");
    const findAll = jest
      .spyOn(InventoryProduct, "findAll")
      .mockResolvedValueOnce([{ id: 1, barcode: "00ÁbC" }] as never)
      .mockResolvedValue([]);
    try {
      const products = await ListInventoryProductsService({
        companyId: 7,
        search: "00ÁbC",
        limit: 20,
        active: true,
        lowStock: true
      });
      expect(products.map(product => product.id)).toEqual([1]);
      const where = findAll.mock.calls[0][0].where as any;
      expect(where.companyId).toBe(7);
      expect(where.active).toBe(true);
      expect(where[Op.and]).toHaveLength(3);
      expect(JSON.stringify(where[Op.and])).toContain("COLLATE");
      expect(findAll.mock.calls[1][0].where).toMatchObject({ sku: "00ÁbC" });
    } finally {
      dialect.mockRestore();
      findAll.mockRestore();
    }
  });
});
