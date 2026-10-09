/**
 * @jest-environment jsdom
 */
import {
  digitsForPersist,
  formatInventoryCustomerDocument,
  formatInventoryCustomerPhone,
  onlyDigits,
} from "../inventoryCustomerMasks";

describe("inventoryCustomerMasks", () => {
  describe("phone", () => {
    it("formata progressivamente celular e fixo", () => {
      expect(formatInventoryCustomerPhone("2")).toBe("(2");
      expect(formatInventoryCustomerPhone("27")).toBe("(27");
      expect(formatInventoryCustomerPhone("279")).toBe("(27) 9");
      expect(formatInventoryCustomerPhone("2733334444")).toBe(
        "(27) 3333-4444"
      );
      expect(formatInventoryCustomerPhone("27999999999")).toBe(
        "(27) 99999-9999"
      );
    });

    it("limita a 11 dígitos e mascara valor legado", () => {
      expect(formatInventoryCustomerPhone("279999999991234")).toBe(
        "(27) 99999-9999"
      );
      expect(formatInventoryCustomerPhone("(27) 99999-9999")).toBe(
        "(27) 99999-9999"
      );
    });

    it("backspace / edição natural via dígitos", () => {
      expect(formatInventoryCustomerPhone("2799999999")).toBe(
        "(27) 9999-9999"
      );
      expect(digitsForPersist("(27) 99999-9999")).toBe("27999999999");
    });
  });

  describe("document CPF/CNPJ", () => {
    it("digita progressivamente CPF", () => {
      expect(formatInventoryCustomerDocument("1")).toBe("1");
      expect(formatInventoryCustomerDocument("129")).toBe("129");
      expect(formatInventoryCustomerDocument("1290")).toBe("129.0");
      expect(formatInventoryCustomerDocument("129009")).toBe("129.009");
      expect(formatInventoryCustomerDocument("129009857")).toBe("129.009.857");
      expect(formatInventoryCustomerDocument("12900985730")).toBe(
        "129.009.857-30"
      );
    });

    it("transiciona para CNPJ após 11 dígitos", () => {
      expect(formatInventoryCustomerDocument("129009857301")).toBe(
        "12.900.985/7301"
      );
      expect(formatInventoryCustomerDocument("00000000000191")).toBe(
        "00.000.000/0001-91"
      );
    });

    it("limita a 14 dígitos e carrega legado sem máscara", () => {
      expect(formatInventoryCustomerDocument("00000000000191111")).toBe(
        "00.000.000/0001-91"
      );
      expect(onlyDigits("129.009.857-30", 14)).toBe("12900985730");
      expect(digitsForPersist("00.000.000/0001-91")).toBe("00000000000191");
      expect(digitsForPersist("")).toBeNull();
    });
  });
});
