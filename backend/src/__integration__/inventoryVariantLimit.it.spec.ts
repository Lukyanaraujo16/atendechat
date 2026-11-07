/**
 * Integração (Postgres real) — limite de 50 variações por produto:
 * cadastro, consulta, edição e venda com exatamente 50; a 51ª é rejeitada sem gravação parcial.
 */
import sequelize from "../database";
import InventoryProduct from "../models/InventoryProduct";
import InventoryProductVariant from "../models/InventoryProductVariant";
import InventoryStockMovement from "../models/InventoryStockMovement";
import SaveInventoryVariableProductService from "../services/InventoryService/SaveInventoryVariableProductService";
import ShowInventoryProductService from "../services/InventoryService/ShowInventoryProductService";
import CreateInventoryProductVariantService from "../services/InventoryService/CreateInventoryProductVariantService";
import CreateInventorySaleService from "../services/InventoryService/CreateInventorySaleService";
import AddInventorySaleItemService from "../services/InventoryService/AddInventorySaleItemService";
import UpdateInventoryProductVariantService from "../services/InventoryService/UpdateInventoryProductVariantService";
import InventoryProductAttribute from "../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../models/InventoryProductAttributeOption";
import {
  assertDisposableDatabase,
  catchError,
  createCompany,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: () => undefined }),
    emit: () => undefined
  })
}));

const sizes = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);
const body = (name: string, n: number) => ({
  name,
  unit: "un",
  characteristics: [{ name: "Tamanho", options: sizes(n) }],
  variants: sizes(n).map((v, i) => ({
    options: [{ characteristicName: "Tamanho", optionValue: v }],
    salePrice: 10 + i,
    currentQuantity: 3
  }))
});

describe("Limite de 50 variações por produto (Postgres real)", () => {
  let company: any;
  let admin: any;
  let productId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    company = await createCompany({ dueDate: daysFromToday(30) });
    admin = await createUser({ companyId: company.id, profile: "admin" });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("cadastra e consulta produto com exatamente 50 variações", async () => {
    const saved = await SaveInventoryVariableProductService({
      companyId: company.id,
      body: body("Camiseta 50", 50),
      createdBy: admin.id
    });
    productId = saved.product.id;
    expect(saved.variants).toHaveLength(50);

    const shown = await ShowInventoryProductService({
      companyId: company.id,
      id: productId
    });
    expect(shown.variants).toHaveLength(50);
    expect(new Set(shown.variants.map((v: any) => v.combinationKey)).size).toBe(
      50
    );
    expect(
      shown.variants.every((v: any) => Number(v.currentQuantity) === 3)
    ).toBe(true);
    expect(
      await InventoryStockMovement.count({
        where: { productId, type: "initial" }
      })
    ).toBe(50);
  });

  it("edita produto com 50 variações preservando ids e estoque", async () => {
    const before = await InventoryProductVariant.findAll({
      where: { productId },
      order: [["id", "ASC"]]
    });
    const edit = body("Camiseta 50 editada", 50);
    edit.variants = before.map(v => ({
      id: v.id,
      options: [{ characteristicName: "Tamanho", optionValue: v.label }],
      salePrice: 99
    })) as any;
    const saved = await SaveInventoryVariableProductService({
      companyId: company.id,
      productId,
      body: edit,
      createdBy: admin.id
    });
    expect(saved.variants).toHaveLength(50);
    expect(saved.variants.map(v => v.id).sort()).toEqual(
      before.map(v => v.id).sort()
    );
    expect(
      saved.variants.every(
        v => Number(v.salePrice) === 99 && Number(v.currentQuantity) === 3
      )
    ).toBe(true);
    expect(await InventoryStockMovement.count({ where: { productId } })).toBe(
      50
    );
  });

  it("vende a 50ª variação", async () => {
    const last = await InventoryProductVariant.findOne({
      where: { productId, label: "T50" }
    });
    const sale = await CreateInventorySaleService({
      companyId: company.id,
      createdBy: admin.id,
      body: {}
    });
    const err = await catchError(
      AddInventorySaleItemService({
        companyId: company.id,
        saleId: sale.id,
        body: { productId, variantId: last!.id, quantity: 1 }
      } as any)
    );
    expect(err).toBeNull();
  });

  it("rejeita a 51ª variação na edição sem alterar nada", async () => {
    const before = await InventoryProductVariant.findAll({
      where: { productId }
    });
    const edit = body("Camiseta 51", 50);
    edit.characteristics.push({ name: "Cor", options: ["Azul"] });
    edit.variants = [
      ...before.map(v => ({
        id: v.id,
        options: [{ characteristicName: "Tamanho", optionValue: v.label }],
        salePrice: 1
      })),
      {
        options: [{ characteristicName: "Cor", optionValue: "Azul" }],
        salePrice: 1,
        currentQuantity: 3
      }
    ] as any;
    const err = await catchError(
      SaveInventoryVariableProductService({
        companyId: company.id,
        productId,
        body: edit
      })
    );
    expect(err?.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");
    expect(err?.clientMessage).toMatch(
      /Limite de 50 variações por produto excedido \(51/
    );
    expect(await InventoryProductVariant.count({ where: { productId } })).toBe(
      50
    );
    expect((await InventoryProduct.findByPk(productId))!.name).toBe(
      "Camiseta 50 editada"
    );
  });

  it("rejeita cadastro com 51 variações sem criar produto", async () => {
    const countBefore = await InventoryProduct.count({
      where: { companyId: company.id }
    });
    const err = await catchError(
      SaveInventoryVariableProductService({
        companyId: company.id,
        body: body("Camiseta 51", 51)
      })
    );
    expect(err?.clientMessage).toBe(
      "A característica Tamanho tem opções demais (máx. 50)."
    );
    expect(
      await InventoryProduct.count({ where: { companyId: company.id } })
    ).toBe(countBefore);
  });

  // ---------- hardening: criação avulsa, reativação, concorrência, legado ----------

  const active = (pid: number) =>
    InventoryProductVariant.count({ where: { productId: pid, active: true } });

  async function ref(attr: string, value: string) {
    const a = await InventoryProductAttribute.findOne({
      where: { companyId: company.id, name: attr }
    });
    const o = await InventoryProductAttributeOption.findOne({
      where: { companyId: company.id, attributeId: a!.id, value }
    });
    return { attributeId: a!.id, optionId: o!.id };
  }

  const createVariant = async (pid: number, tam: string, isActive = true) =>
    CreateInventoryProductVariantService({
      companyId: company.id,
      productId: pid,
      body: {
        options: [await ref("Tamanho", tam), await ref("Cor", "Azul")],
        salePrice: 5,
        active: isActive
      }
    });

  const updateVariant = (pid: number, variantId: number, b: any) =>
    UpdateInventoryProductVariantService({
      companyId: company.id,
      productId: pid,
      variantId,
      body: b
    });

  /** Produto com n variações (Tamanho), as últimas `inactive` desativadas; declara Cor para combinações extras. */
  async function variableProduct(name: string, n: number, inactive = 0) {
    const b: any = body(name, n);
    b.characteristics.push({ name: "Cor", options: ["Azul", "Verde"] });
    b.variants.forEach((v: any, i: number) => {
      if (i >= n - inactive) {
        v.active = false;
        delete v.currentQuantity; // saldo inicial em variação inativa é bloqueado
      }
    });
    const saved = await SaveInventoryVariableProductService({
      companyId: company.id,
      body: b,
      createdBy: admin.id
    });
    const variants = await InventoryProductVariant.findAll({
      where: { productId: saved.product.id },
      order: [["id", "ASC"]]
    });
    return { id: saved.product.id as number, variants };
  }

  it("reativação com 49 ativas é permitida até 50", async () => {
    const p = await variableProduct("Reativa 49", 50, 1);
    expect(await active(p.id)).toBe(49);
    const err = await catchError(
      updateVariant(p.id, p.variants[49].id, { active: true })
    );
    expect(err).toBeNull();
    expect(await active(p.id)).toBe(50);
  });

  it("variação avulsa: 51ª ativa é rejeitada; inativa é permitida", async () => {
    const err = await catchError(createVariant(productId, "T1"));
    expect(err?.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");
    expect(await active(productId)).toBe(50);
    expect(await catchError(createVariant(productId, "T2", false))).toBeNull();
    expect(await active(productId)).toBe(50);
  });

  it("reativação com 50 ativas é rejeitada", async () => {
    const inactive = await InventoryProductVariant.findOne({
      where: { productId, active: false }
    });
    const err = await catchError(
      updateVariant(productId, inactive!.id, { active: true, salePrice: 1 })
    );
    expect(err?.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");
    await inactive!.reload();
    expect(inactive!.active).toBe(false);
    expect(Number(inactive!.salePrice)).toBe(5);
    expect(await active(productId)).toBe(50);
  });

  it("atualização de preço/SKU com 50 ativas é permitida", async () => {
    const v = await InventoryProductVariant.findOne({
      where: { productId, active: true }
    });
    const err = await catchError(
      updateVariant(productId, v!.id, {
        salePrice: 123,
        sku: `SKU-LIM-${Date.now()}`,
        active: true
      })
    );
    expect(err).toBeNull();
    await v!.reload();
    expect(Number(v!.salePrice)).toBe(123);
    expect(await active(productId)).toBe(50);
  });

  it("requisições concorrentes não resultam em 51 ativas", async () => {
    const p = await variableProduct("Concorrência", 50, 1);
    expect(await active(p.id)).toBe(49);
    const azul = await ref("Cor", "Azul");
    const bodies = await Promise.all(
      sizes(5).map(async tam => ({
        options: [await ref("Tamanho", tam), azul],
        salePrice: 5
      }))
    );
    // Opções resolvidas antes: todas as escritas disparam juntas.
    const results = await Promise.allSettled([
      updateVariant(p.id, p.variants[49].id, { active: true }),
      ...bodies.map(b =>
        CreateInventoryProductVariantService({
          companyId: company.id,
          productId: p.id,
          body: b
        })
      )
    ]);
    const ok = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(
      r =>
        r.status === "rejected" &&
        (r.reason as any)?.message === "ERR_INVENTORY_VARIANT_LIMIT"
    );
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    expect(await active(p.id)).toBe(50);
  });

  describe("produto legado com 52 variações ativas", () => {
    let legacyId: number;
    const cores = ["Azul", "Verde"];
    const tams = sizes(26);

    const rowsOf = async (overrides: (v: any) => any = () => ({})) => {
      const variants = await InventoryProductVariant.findAll({
        where: { productId: legacyId },
        order: [["id", "ASC"]]
      });
      return variants.map(v => {
        const [cor, tam] = v.label.split(" / ");
        return {
          id: v.id,
          options: [
            { characteristicName: "Cor", optionValue: cor },
            { characteristicName: "Tamanho", optionValue: tam }
          ],
          salePrice: Number(v.salePrice),
          active: v.active,
          ...overrides(v)
        };
      });
    };
    const legacyBody = (variants: any[]) => ({
      name: "Legado 52",
      unit: "un",
      characteristics: [
        { name: "Cor", options: cores },
        { name: "Tamanho", options: tams }
      ],
      variants
    });

    beforeAll(async () => {
      // Simula dado legado (antes do limite): duas metades de 26 unidas no mesmo produto.
      const saveHalf = async (cor: string): Promise<number> => {
        const saved = await SaveInventoryVariableProductService({
          companyId: company.id,
          createdBy: admin.id,
          body: {
            name: `Legado ${cor}`,
            unit: "un",
            characteristics: [
              { name: "Cor", options: [cor] },
              { name: "Tamanho", options: tams }
            ],
            variants: tams.map(tam => ({
              options: [
                { characteristicName: "Cor", optionValue: cor },
                { characteristicName: "Tamanho", optionValue: tam }
              ],
              salePrice: 20,
              currentQuantity: 2
            }))
          }
        });
        return saved.product.id;
      };
      legacyId = await saveHalf(cores[0]);
      const otherId = await saveHalf(cores[1]);
      await InventoryProductVariant.update(
        { productId: legacyId },
        { where: { productId: otherId } }
      );
      expect(await active(legacyId)).toBe(52);
    });

    it("consulta", async () => {
      const shown = await ShowInventoryProductService({
        companyId: company.id,
        id: legacyId
      });
      expect(shown.variants).toHaveLength(52);
    });

    it("edita preço sem aumento", async () => {
      const err = await catchError(
        SaveInventoryVariableProductService({
          companyId: company.id,
          productId: legacyId,
          body: legacyBody(await rowsOf(() => ({ salePrice: 33 })))
        })
      );
      expect(err).toBeNull();
      expect(await active(legacyId)).toBe(52);
      const v = await InventoryProductVariant.findOne({
        where: { productId: legacyId }
      });
      expect(Number(v!.salePrice)).toBe(33);
      expect(Number(v!.currentQuantity)).toBe(2);
    });

    it("vende variação existente", async () => {
      const v = await InventoryProductVariant.findOne({
        where: { productId: legacyId }
      });
      const sale = await CreateInventorySaleService({
        companyId: company.id,
        createdBy: admin.id,
        body: {}
      });
      const err = await catchError(
        AddInventorySaleItemService({
          companyId: company.id,
          saleId: sale.id,
          body: { productId: legacyId, variantId: v!.id, quantity: 1 }
        } as any)
      );
      expect(err).toBeNull();
    });

    it("desativa, mas não reativa acima do limite", async () => {
      const v = await InventoryProductVariant.findOne({
        where: { productId: legacyId },
        order: [["id", "DESC"]]
      });
      expect(
        await catchError(updateVariant(legacyId, v!.id, { active: false }))
      ).toBeNull();
      expect(await active(legacyId)).toBe(51);

      const single = await catchError(
        updateVariant(legacyId, v!.id, { active: true })
      );
      expect(single?.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");

      const viaSave = await catchError(
        SaveInventoryVariableProductService({
          companyId: company.id,
          productId: legacyId,
          body: legacyBody(await rowsOf(() => ({ active: true })))
        })
      );
      expect(viaSave?.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");
      expect(await active(legacyId)).toBe(51);
    });

    it("reduz a quantidade de variações", async () => {
      const rows = (await rowsOf()).filter(r => r.active).slice(0, 45);
      const err = await catchError(
        SaveInventoryVariableProductService({
          companyId: company.id,
          productId: legacyId,
          body: legacyBody(rows)
        })
      );
      expect(err).toBeNull();
      expect(await active(legacyId)).toBe(45);
    });
  });
});
