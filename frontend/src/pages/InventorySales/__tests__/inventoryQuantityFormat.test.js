import {
  formatQuantity,
  normalizeQuantityInputValue,
  parseQuantityValue,
  quantityValuesEqual,
} from "../utils";

describe("inventory quantity format (DECIMAL / pt-BR)", () => {
  it("API '1.000' / 1.000 representa 1 (não mil)", () => {
    expect(parseQuantityValue("1.000")).toBe(1);
    expect(parseQuantityValue(1.0)).toBe(1);
    expect(normalizeQuantityInputValue("1.000")).toBe("1");
    expect(formatQuantity("1.000")).toBe("1");
  });

  it("API '2.000' representa 2; '10.000' representa 10", () => {
    expect(normalizeQuantityInputValue("2.000")).toBe("2");
    expect(normalizeQuantityInputValue("10.000")).toBe("10");
    expect(formatQuantity("10.000")).toBe("10");
  });

  it("quantidade 1000 permanece 1000 (sem separador de milhar)", () => {
    expect(normalizeQuantityInputValue(1000)).toBe("1000");
    expect(formatQuantity(1000)).toBe("1000");
    expect(formatQuantity(1000)).not.toBe("1.000");
  });

  it("fracionários: 1.500 → 1.5 / exibição 1,5; 0.500 → 0.5 / 0,5", () => {
    expect(parseQuantityValue("1.500")).toBe(1.5);
    expect(normalizeQuantityInputValue("1.500")).toBe("1.5");
    expect(formatQuantity("1.500")).toBe("1,5");
    expect(normalizeQuantityInputValue("0.500")).toBe("0.5");
    expect(formatQuantity("0.500")).toBe("0,5");
  });

  it("1.250 → 1.25 / 1,25", () => {
    expect(normalizeQuantityInputValue("1.250")).toBe("1.25");
    expect(formatQuantity(1.25)).toBe("1,25");
  });

  it("equality ignora zeros à direita da escala DECIMAL", () => {
    expect(quantityValuesEqual("1", "1.000")).toBe(true);
    expect(quantityValuesEqual("1.5", "1.500")).toBe(true);
    expect(quantityValuesEqual("1000", "1.000")).toBe(false);
  });

  it("digitação intermediária com vírgula é parseável", () => {
    expect(parseQuantityValue("1,5")).toBe(1.5);
    expect(normalizeQuantityInputValue("1,25")).toBe("1.25");
  });
});
