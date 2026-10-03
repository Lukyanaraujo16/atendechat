import {
  inspectProductUnit,
  resolveProductUnit,
  splitProductUnit,
  KNOWN_PRODUCT_UNITS,
  PRODUCT_UNIT_OTHER,
} from "../productUnit";

describe("regra de unidade de medida", () => {
  it("aceita conhecidas e personalizadas e rejeita quantidade", () => {
    expect(KNOWN_PRODUCT_UNITS).toEqual([
      "un",
      "kg",
      "g",
      "L",
      "mL",
      "m",
      "cm",
      "cx",
      "pct",
    ]);
    expect(inspectProductUnit("un").issue).toBeNull();
    expect(inspectProductUnit("kg").issue).toBeNull();
    expect(inspectProductUnit("par").issue).toBeNull();
    expect(inspectProductUnit("50").issue).toBe("numeric");
    expect(inspectProductUnit("01").issue).toBe("numeric");
    expect(inspectProductUnit("").issue).toBe("empty");
    expect(inspectProductUnit("12345678901234567").issue).toBe("too_long");
    expect(inspectProductUnit("un50").issue).toBe("suspicious");
    expect(inspectProductUnit("un1").issue).toBe("suspicious");
  });

  it("trata unidade fora da lista como personalizada sem apagar o valor", () => {
    expect(splitProductUnit("kg").unitChoice).toBe("kg");
    expect(splitProductUnit("un50")).toEqual({
      unitChoice: PRODUCT_UNIT_OTHER,
      customUnit: "un50",
    });
    expect(splitProductUnit("60").customUnit).toBe("60");
    expect(resolveProductUnit("un", "")).toBe("un");
    expect(resolveProductUnit(PRODUCT_UNIT_OTHER, " par ")).toBe("par");
  });
});
