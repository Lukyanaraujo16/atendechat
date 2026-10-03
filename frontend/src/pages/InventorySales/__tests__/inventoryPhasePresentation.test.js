import { i18n } from "../../../translate/i18n";
import {
  LISTABLE_STOCK_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPES,
} from "../constants";
import { describeProductStock, formatSignedQuantity } from "../utils";

describe("estoque e movimentações — apresentação", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt");
  });

  it("separa quantidade, unidade e mínimo sem mascarar un50", () => {
    const separated = describeProductStock({
      trackStock: true,
      currentQuantity: 19,
      unit: "un",
      minStock: 10,
    });
    expect(separated.quantityText).toBe("19 un");
    expect(separated.quantityText).not.toContain("un50");
    expect(separated.minText).toBe("10");
    expect(separated.status).toBe("ok");

    const exact = describeProductStock({
      trackStock: true,
      currentQuantity: 19,
      unit: "un",
      minStock: 50,
    });
    expect(exact.quantityText).toBe("19 un");
    expect(`${exact.quantityText}`).not.toBe("19 un50");
    expect(exact.minText).toBe("50");

    const rawUnit = describeProductStock({
      trackStock: true,
      currentQuantity: 19,
      unit: "un50",
      minStock: 50,
    });
    expect(rawUnit.quantityText).toBe("19 un50");
    expect(rawUnit.minText).toBe("50");
    expect(rawUnit.status).toBe("low");
  });

  it("zero, estoque baixo e sem controle", () => {
    expect(
      describeProductStock({
        trackStock: true,
        currentQuantity: 0,
        unit: "un",
        minStock: 10,
      }).status
    ).toBe("out");
    expect(i18n.t("inventorySales.products.outOfStock")).toBe("Sem estoque");

    const low = describeProductStock({
      trackStock: true,
      currentQuantity: 5,
      unit: "un",
      minStock: 10,
    });
    expect(low.status).toBe("low");
    expect(low.quantityText).toBe("5 un");
    expect(i18n.t("inventorySales.products.lowStockBadge")).toBe("Estoque baixo");

    expect(
      describeProductStock({ trackStock: false, currentQuantity: 3, unit: "un" })
        .status
    ).toBe("untracked");
    expect(i18n.t("inventorySales.products.noStockTracking")).toBe("Sem controle");
  });

  it("traduz sale e sale_reversal e o filtro lista os seis tipos", async () => {
    expect(STOCK_MOVEMENT_TYPES).toEqual(["in", "out", "adjustment", "initial"]);
    expect(LISTABLE_STOCK_MOVEMENT_TYPES).toEqual([
      "in",
      "out",
      "adjustment",
      "initial",
      "sale",
      "sale_reversal",
    ]);
    expect(i18n.t("inventorySales.stock.types.sale")).toBe("Venda");
    expect(i18n.t("inventorySales.stock.types.sale_reversal")).toBe(
      "Estorno de venda"
    );

    await i18n.changeLanguage("en");
    expect(i18n.t("inventorySales.stock.types.sale")).toBe("Sale");
    expect(i18n.t("inventorySales.stock.types.sale_reversal")).toBe(
      "Sale reversal"
    );

    await i18n.changeLanguage("es");
    expect(i18n.t("inventorySales.stock.types.sale")).toBe("Venta");
    expect(i18n.t("inventorySales.stock.types.sale_reversal")).toBe(
      "Reversión de venta"
    );
    await i18n.changeLanguage("pt");
  });

  it("quantidade com sinal único", () => {
    expect(formatSignedQuantity(10)).toBe("+10");
    expect(formatSignedQuantity(-1)).toBe("-1");
    expect(formatSignedQuantity(0)).toBe("0");
    expect(formatSignedQuantity("-2")).toBe("-2");
  });
});
