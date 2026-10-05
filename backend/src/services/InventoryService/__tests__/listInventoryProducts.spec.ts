import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import InventoryProduct from "../../../models/InventoryProduct";
import ListInventoryProductsService, {
  parseOptionalProductListLimit
} from "../ListInventoryProductsService";

function expectFolded(clauses: any, term: string) {
  expect(clauses).toHaveLength(3);
  const dumped = JSON.stringify(clauses);
  ["name", "sku", "barcode"].forEach(column => {
    expect(dumped).toContain(column);
  });
  expect(dumped).toContain("utf8mb4_unicode_ci");
  expect(dumped).toContain("InventoryProduct");
  clauses.forEach((clause: any) => {
    expect(clause.logic[Op.like]).toBe(`%${term}%`);
  });
}

function expectInvalidLimit(value: unknown) {
  try {
    parseOptionalProductListLimit(value);
    throw new Error("expected AppError");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toBe("ERR_VALIDATION_ERROR");
    expect((err as AppError).statusCode).toBe(400);
  }
}

describe("ListInventoryProductsService", () => {
  const findAll = jest.spyOn(InventoryProduct, "findAll");
  const update = jest.spyOn(InventoryProduct, "update");
  const create = jest.spyOn(InventoryProduct, "create");

  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue([] as never);
    update.mockReset();
    update.mockResolvedValue([0] as never);
    create.mockReset();
    create.mockResolvedValue({} as never);
  });

  afterAll(() => {
    findAll.mockRestore();
    update.mockRestore();
    create.mockRestore();
  });

  it("sem limit preserva a listagem completa", async () => {
    await ListInventoryProductsService({ companyId: 4, active: "true" });
    expect(findAll).toHaveBeenCalledTimes(1);
    const options = findAll.mock.calls[0][0] as { limit?: number; where: any };
    expect(options.limit).toBeUndefined();
    expect(options.where).toEqual({ companyId: 4, active: true });
  });

  it("search sem limit continua uma única query LIKE", async () => {
    await ListInventoryProductsService({ companyId: 4, search: " abc " });
    expect(findAll).toHaveBeenCalledTimes(1);
    const options = findAll.mock.calls[0][0] as { limit?: number; where: any };
    expect(options.limit).toBeUndefined();
    expect(options.where.companyId).toBe(4);
    expectFolded(options.where[Op.or], "abc");
  });

  it("limit=20 e o teto 50 aplicam o limite sem clamp acima disso", async () => {
    await ListInventoryProductsService({ companyId: 4, limit: "20" });
    const listed = findAll.mock.calls[0][0] as {
      limit: number;
      order: unknown;
      where: any;
    };
    expect(listed.limit).toBe(20);
    expect(listed.order).toEqual([
      ["name", "ASC"],
      ["id", "ASC"]
    ]);
    expect(listed.where[Op.or]).toBeUndefined();

    findAll.mockClear();
    await ListInventoryProductsService({ companyId: 4, limit: 50 });
    expect((findAll.mock.calls[0][0] as { limit: number }).limit).toBe(50);

    findAll.mockClear();
    await expect(
      ListInventoryProductsService({ companyId: 4, limit: "51" })
    ).rejects.toMatchObject({
      message: "ERR_VALIDATION_ERROR",
      statusCode: 400
    });
    expect(findAll).not.toHaveBeenCalled();
  });

  it("rejeita limit inválido", () => {
    expect(parseOptionalProductListLimit(undefined)).toBeUndefined();
    expect(parseOptionalProductListLimit("")).toBeUndefined();
    expect(parseOptionalProductListLimit(null)).toBeUndefined();
    ["0", "-1", "1.5", "20abc", "true", true, [], {}, { limit: 20 }].forEach(
      value => expectInvalidLimit(value)
    );
  });

  it("prioriza barcode exato, depois SKU exato, e mantém duplicados", async () => {
    findAll.mockImplementation((async (options?: {
      where?: any;
      limit?: number;
    }) => {
      const where = options?.where || {};
      if (where.barcode === "789") {
        return [
          { id: 2, name: "Zebra", barcode: "789", sku: "Z" },
          { id: 1, name: "Alpha", barcode: "789", sku: "A" }
        ] as never;
      }
      if (where.sku === "789") {
        return [
          { id: 5, name: "Sku only", barcode: "111", sku: "789" }
        ] as never;
      }
      return [{ id: 9, name: "Capa 789", barcode: "000", sku: "CAP" }] as never;
    }) as any);

    const rows = await ListInventoryProductsService({
      companyId: 7,
      search: "789",
      limit: 20,
      active: true
    });

    expect(rows.map(row => row.id)).toEqual([2, 1, 5, 9]);
    expect(findAll.mock.calls.length).toBeGreaterThanOrEqual(3);
    findAll.mock.calls.forEach(call => {
      const { where } = call[0] as { where: any };
      expect(where.companyId).toBe(7);
      expect(where.active).toBe(true);
    });
    const skuWhere = (findAll.mock.calls[1][0] as { where: any }).where;
    expect(skuWhere.id[Op.notIn]).toEqual([2, 1]);
  });

  it("SKU exato vem antes do parcial quando o barcode não fecha", async () => {
    findAll.mockImplementation((async (options?: { where?: any }) => {
      const where = options?.where || {};
      if (where.barcode === "CAP29") return [] as never;
      if (where.sku === "CAP29") {
        return [
          { id: 4, name: "Capinha", sku: "CAP29", barcode: "100" }
        ] as never;
      }
      return [{ id: 8, name: "CAP29 azul", sku: "X", barcode: "200" }] as never;
    }) as any);

    const rows = await ListInventoryProductsService({
      companyId: 7,
      search: "CAP29",
      limit: "20"
    });
    expect(rows.map(row => row.id)).toEqual([4, 8]);
  });

  it("não devolve produto de outra empresa", async () => {
    findAll.mockImplementation((async (options?: { where?: any }) => {
      const where = options?.where || {};
      if (where.companyId !== 4) {
        return [
          { id: 99, name: "Segredo", barcode: "SAME", companyId: 9 }
        ] as never;
      }
      if (where.barcode === "SAME") {
        return [{ id: 1, name: "Meu", barcode: "SAME", companyId: 4 }] as never;
      }
      return [] as never;
    }) as any);

    const rows = await ListInventoryProductsService({
      companyId: 4,
      search: "SAME",
      limit: 20
    });
    expect(rows).toEqual([
      { id: 1, name: "Meu", barcode: "SAME", companyId: 4 }
    ]);
    findAll.mock.calls.forEach(call => {
      expect((call[0] as { where: any }).where.companyId).toBe(4);
    });
  });

  it("não grava estoque nem produto durante a busca", async () => {
    await ListInventoryProductsService({
      companyId: 4,
      search: "cap",
      limit: 20,
      active: true
    });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("busca parcial ignora caixa e acento sem alterar o barcode exato", async () => {
    await ListInventoryProductsService({
      companyId: 4,
      search: "capinha",
      limit: 20
    });
    expect((findAll.mock.calls[0][0] as { where: any }).where.barcode).toBe(
      "capinha"
    );
    const partial = findAll.mock.calls.find(
      call => (call[0] as { where: any }).where[Op.or]
    );
    expectFolded((partial?.[0] as { where: any }).where[Op.or], "capinha");

    findAll.mockClear();
    await ListInventoryProductsService({
      companyId: 4,
      search: "Película",
      limit: 20
    });
    const accent = findAll.mock.calls.find(
      call => (call[0] as { where: any }).where[Op.or]
    );
    expectFolded((accent?.[0] as { where: any }).where[Op.or], "Película");

    findAll.mockClear();
    await ListInventoryProductsService({
      companyId: 4,
      search: "ABC-123",
      limit: 20
    });
    expect((findAll.mock.calls[0][0] as { where: any }).where.barcode).toBe(
      "ABC-123"
    );
    const code = findAll.mock.calls.find(
      call => (call[0] as { where: any }).where[Op.or]
    );
    const dumped = JSON.stringify((code?.[0] as { where: any }).where[Op.or]);
    expect(dumped).toContain("utf8mb4_unicode_ci");
    (code?.[0] as { where: any }).where[Op.or].forEach((clause: any) => {
      expect(clause.logic[Op.like]).toBe("%ABC-123%");
    });
  });
});
