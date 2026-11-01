/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptContent from "../SaleReceiptContent";
import { getThemeOptions } from "../../../theme/appThemeOptions";
import { getSaleCustomerName } from "../utils";

jest.mock("../../../hooks/useIsMobile", () => () => false);

const baseSale = {
  id: 7,
  status: "completed",
  saleNumber: 7,
  subtotalAmount: 10,
  discountAmount: 0,
  totalAmount: 10,
  paidAmount: 10,
  items: [],
  contactId: null,
  contact: null,
  customerId: null,
  customer: null,
};

function renderReceipt(sale, props = {}) {
  const theme = createTheme(getThemeOptions("light"));
  return render(
    <ThemeProvider theme={theme}>
      <SaleReceiptContent sale={sale} layout="screen" {...props} />
    </ThemeProvider>
  );
}

const customerSale = {
  ...baseSale,
  customerId: 5,
  customer: { id: 5, name: "Maria Comercial", document: "12900985730", phone: "27988887777", contactId: null },
};

describe("Recibo não fiscal — cliente da venda", () => {
  beforeAll(() => changeLanguage("pt"));

  it("cliente comercial sem contato aparece com CPF e telefone", () => {
    const { container } = renderReceipt(customerSale);
    expect(screen.getByText("Maria Comercial")).toBeTruthy();
    expect(container.textContent).toContain("129.009.857-30");
    expect(container.textContent).toContain("(27) 98888-7777");
    expect(container.textContent).not.toContain("Sem cliente");
  });

  it("impressão térmica também mostra o cliente", () => {
    const { container } = renderReceipt(customerSale, { layout: "print", format: "thermal80" });
    expect(container.textContent).toContain("Maria Comercial");
    expect(container.textContent).toContain("129.009.857-30");
  });

  it("venda antiga só com contato usa o contato; sem cliente mostra 'Sem cliente'", () => {
    renderReceipt({ ...baseSale, contactId: 3, contact: { id: 3, name: "Contato WhatsApp", number: "5527999" } });
    expect(screen.getByText("Contato WhatsApp")).toBeTruthy();
    const { container } = renderReceipt(baseSale);
    expect(container.textContent).toContain("Sem cliente");
  });

  it("cliente comercial tem prioridade sobre o contato", () => {
    expect(
      getSaleCustomerName({ customer: { name: "Comercial" }, contact: { name: "Contato" } })
    ).toBe("Comercial");
    expect(getSaleCustomerName(null)).toBe("");
  });
});
