import AppError from "../../../errors/AppError";
import InventoryProduct from "../../../models/InventoryProduct";
import CreateInventoryProductService from "../CreateInventoryProductService";
import UpdateInventoryProductService from "../UpdateInventoryProductService";
import {
  assertNewInventoryProductUnit,
  resolveInventoryProductUnitForUpdate
} from "../inventoryProductUnit";

function expectUnitError(run: () => unknown, message: string) {
  try {
    run();
    throw new Error("expected AppError");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).clientMessage).toBe(message);
  }
}

describe("unidade de medida do produto", () => {
  const create = jest
    .spyOn(InventoryProduct, "create")
    .mockResolvedValue({ id: 1 } as never);
  const findOne = jest.spyOn(InventoryProduct, "findOne");

  afterEach(() => {
    create.mockClear();
    findOne.mockReset();
  });

  afterAll(() => {
    create.mockRestore();
    findOne.mockRestore();
  });

  it("aceita unidades conhecidas e personalizadas", () => {
    expect(assertNewInventoryProductUnit("un")).toBe("un");
    expect(assertNewInventoryProductUnit(" kg ")).toBe("kg");
    expect(assertNewInventoryProductUnit("par")).toBe("par");
  });

  it("rejeita vazio, numérico, longo e suspeito na criação", () => {
    expectUnitError(
      () => assertNewInventoryProductUnit("   "),
      "Informe a unidade de medida."
    );
    expectUnitError(
      () => assertNewInventoryProductUnit("50"),
      "A unidade de medida não pode ser apenas um número."
    );
    expectUnitError(
      () => assertNewInventoryProductUnit("01"),
      "A unidade de medida não pode ser apenas um número."
    );
    expectUnitError(
      () => assertNewInventoryProductUnit("12345678901234567"),
      "A unidade de medida deve ter no máximo 16 caracteres."
    );
    expectUnitError(
      () => assertNewInventoryProductUnit("un50"),
      "A unidade de medida parece misturar medida e quantidade."
    );
  });

  it("create grava un e par e recusa 50 sem persistir", async () => {
    await CreateInventoryProductService({
      companyId: 7,
      body: { name: "Caneta", salePrice: 10, unit: "un", currentQuantity: 19 }
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 7, unit: "un", currentQuantity: 19 })
    );

    await CreateInventoryProductService({
      companyId: 7,
      body: { name: "Par", salePrice: 10, unit: "par", trackStock: false }
    });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ companyId: 7, unit: "par", trackStock: false })
    );

    create.mockClear();
    await expect(
      CreateInventoryProductService({
        companyId: 7,
        body: { name: "Ruim", salePrice: 10, unit: "50" }
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(create).not.toHaveBeenCalled();
  });

  it("update preserva un50 se não mudar e valida o valor novo", async () => {
    expect(resolveInventoryProductUnitForUpdate("un50", "un50")).toBe("un50");
    expect(resolveInventoryProductUnitForUpdate("un", "un50")).toBe("un");
    expectUnitError(
      () => resolveInventoryProductUnitForUpdate("50", "un50"),
      "A unidade de medida não pode ser apenas um número."
    );

    const update = jest.fn().mockResolvedValue(undefined);
    const reload = jest
      .fn()
      .mockImplementation(function reloadProduct(this: { unit: string }) {
        return Promise.resolve(this);
      });
    findOne.mockResolvedValue({
      id: 4,
      companyId: 7,
      unit: "un50",
      update,
      reload
    } as never);

    await UpdateInventoryProductService({
      companyId: 7,
      id: 4,
      body: { unit: "un50", name: "Legado" }
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 4, companyId: 7 }
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ unit: "un50", name: "Legado" })
    );

    update.mockClear();
    await UpdateInventoryProductService({
      companyId: 7,
      id: 4,
      body: { unit: "un" }
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ unit: "un" })
    );

    update.mockClear();
    await expect(
      UpdateInventoryProductService({
        companyId: 7,
        id: 4,
        body: { unit: "50" }
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(update).not.toHaveBeenCalled();
  });
});
