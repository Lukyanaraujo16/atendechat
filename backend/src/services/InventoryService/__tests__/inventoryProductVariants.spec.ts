/**
 * Testes de domínio de produtos com variações (helpers + regras).
 */
import {
  INVENTORY_PRODUCT_KIND_SIMPLE,
  INVENTORY_PRODUCT_KIND_VARIABLE,
  isSimpleProduct,
  isVariableProduct,
  normalizeInventoryProductKind
} from "../inventoryProductKind";
import {
  buildCombinationKey,
  buildVariantLabel,
  parseOptionIds
} from "../inventoryVariantCombination";
import { normalizeSellableCode } from "../inventorySellableCodes";
import {
  buildProductSnapshot,
  buildVariantSaleSnapshot
} from "../inventorySaleHelpers";

describe("inventoryProductKind", () => {
  it("defaults to simple", () => {
    expect(normalizeInventoryProductKind(undefined)).toBe(
      INVENTORY_PRODUCT_KIND_SIMPLE
    );
    expect(normalizeInventoryProductKind("VARIABLE")).toBe(
      INVENTORY_PRODUCT_KIND_VARIABLE
    );
    expect(isVariableProduct({ productKind: "variable" })).toBe(true);
    expect(isSimpleProduct({ productKind: "simple" })).toBe(true);
  });
});

describe("inventoryVariantCombination", () => {
  it("builds canonical key independent of option order", () => {
    const a = buildCombinationKey([
      { attributeId: 2, optionId: 20 },
      { attributeId: 1, optionId: 10 }
    ]);
    const b = buildCombinationKey([
      { attributeId: 1, optionId: 10 },
      { attributeId: 2, optionId: 20 }
    ]);
    expect(a).toBe(b);
    expect(a).toBe("1:10|2:20");
  });

  it("builds readable label", () => {
    expect(
      buildVariantLabel([
        { attributeName: "Cor", optionValue: "Preta" },
        { attributeName: "Tamanho", optionValue: "M" }
      ])
    ).toBe("Preta / M");
  });

  it("parses option ids and ignores duplicate attributes", () => {
    const parsed = parseOptionIds([
      { attributeId: 1, optionId: 10 },
      { attributeId: 1, optionId: 11 },
      { attributeId: 2, optionId: 20 }
    ]);
    expect(parsed).toEqual([
      { attributeId: 1, optionId: 10 },
      { attributeId: 2, optionId: 20 }
    ]);
  });

  it("supports three commercial combinations without forcing cartesian product", () => {
    const keys = [
      buildCombinationKey([
        { attributeId: 1, optionId: 10 },
        { attributeId: 2, optionId: 20 }
      ]),
      buildCombinationKey([
        { attributeId: 1, optionId: 10 },
        { attributeId: 2, optionId: 21 }
      ]),
      buildCombinationKey([
        { attributeId: 1, optionId: 11 },
        { attributeId: 2, optionId: 20 }
      ])
    ];
    expect(new Set(keys).size).toBe(3);
  });
});

describe("inventorySellableCodes normalize", () => {
  it("trims and nullifies empty", () => {
    expect(normalizeSellableCode("  ABC  ")).toBe("ABC");
    expect(normalizeSellableCode("")).toBeNull();
    expect(normalizeSellableCode(null)).toBeNull();
  });
});

describe("sale snapshots for variants", () => {
  const product = {
    id: 10,
    name: "iPhone 17 Pro Max",
    sku: "IPHONE-PARENT",
    unit: "un",
    salePrice: "0.00",
    costPrice: null,
    trackStock: false
  } as any;

  it("simple snapshot keeps variantId null", () => {
    const snap = buildProductSnapshot({
      ...product,
      salePrice: "100.00",
      costPrice: "80.00",
      trackStock: true
    });
    expect(snap.variantId).toBeNull();
    expect(snap.variantLabel).toBeNull();
    expect(snap.unitPrice).toBe(100);
  });

  it("variant snapshot uses variant price/sku/label", () => {
    const snap = buildVariantSaleSnapshot(product, {
      id: 55,
      label: "Azul",
      sku: "IPHONE-AZUL",
      barcode: "789100",
      salePrice: "9999.00",
      costPrice: "7000.00",
      trackStock: true
    });
    expect(snap.productId).toBe(10);
    expect(snap.variantId).toBe(55);
    expect(snap.variantLabel).toBe("Azul");
    expect(snap.variantSku).toBe("IPHONE-AZUL");
    expect(snap.variantBarcode).toBe("789100");
    expect(snap.unitPrice).toBe(9999);
    expect(snap.productSku).toBe("IPHONE-AZUL");
  });
});
