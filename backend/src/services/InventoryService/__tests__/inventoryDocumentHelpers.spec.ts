import {
  isValidCnpj,
  isValidCpf,
  normalizeDocumentDigits,
  validateAndNormalizeDocument
} from "../inventoryDocumentHelpers";

describe("inventoryDocumentHelpers", () => {
  it("normaliza documento para dígitos", () => {
    expect(normalizeDocumentDigits("123.456.789-09")).toBe("12345678909");
    expect(normalizeDocumentDigits(null)).toBeNull();
  });

  it("valida CPF conhecido", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("valida CNPJ conhecido", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("bloqueia documento inválido", () => {
    expect(() => validateAndNormalizeDocument("123")).toThrow();
    try {
      validateAndNormalizeDocument("52998224725", "company");
      fail("expected throw");
    } catch (err: any) {
      expect(err.message).toBe("ERR_INVENTORY_CUSTOMER_DOCUMENT_TYPE");
      expect(err.clientMessage).toMatch(/CPF/);
    }
  });
});
