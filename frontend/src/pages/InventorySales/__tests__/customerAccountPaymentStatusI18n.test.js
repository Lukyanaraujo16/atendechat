/**
 * @jest-environment jsdom
 */
import { changeLanguage, i18n } from "../../../translate/i18n";

describe("ACHADO 2 Conta do Cliente paymentStatus i18n", () => {
  it.each(["pt", "en", "es"])(
    "header fields.paymentStatus é string em %s",
    async (lang) => {
      await changeLanguage(lang);
      const header = i18n.t("inventorySales.sales.fields.paymentStatus");
      expect(typeof header).toBe("string");
      expect(header).not.toMatch(/returned an object/);
      expect(header.length).toBeGreaterThan(0);

      // A chave-pai é objeto: i18n devolve aviso (string) se usada como label.
      const nestedMisuse = i18n.t("inventorySales.sales.paymentStatus");
      expect(typeof nestedMisuse).toBe("string");
      expect(nestedMisuse).toMatch(/returned an object instead of string/i);

      const paid = i18n.t("inventorySales.sales.paymentStatus.paid");
      expect(typeof paid).toBe("string");
      expect(paid).not.toMatch(/returned an object/);
      expect(paid.length).toBeGreaterThan(0);
    }
  );
});
