/**
 * @jest-environment jsdom
 *
 * Regressão real da homologação: totais/meta/cabeçalhos visíveis, linhas do
 * corpo invisíveis no tema escuro (MuiTableCell text.primary claro no papel
 * branco do recibo). Os itens chegavam; a cor do td não estava fixada.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptContent from "../SaleReceiptContent";
import { getInventorySaleItems } from "../normalizeInventorySale";
import { getThemeOptions } from "../../../theme/appThemeOptions";

jest.mock("../../../hooks/useIsMobile", () => () => false);

/**
 * Shape real típico do GET /inventory/sales/:id após toJSON do Sequelize
 * (DECIMALs como string, items sob `items`, product aninhado).
 */
function realGetSalePayload(overrides = {}) {
  return {
    id: 4,
    companyId: 1,
    saleNumber: 4,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "pix",
    subtotalAmount: "89.70",
    discountAmount: "10.00",
    totalAmount: "79.70",
    paidAmount: "79.70",
    cardInstallmentCount: null,
    completedAt: "2026-10-07T14:00:00.000Z",
    contact: { id: 9, name: "Cliente Homolog", number: "5511999999999" },
    seller: { id: 3, name: "Vendedor Teste", email: "v@test.com" },
    items: [
      {
        id: 101,
        saleId: 4,
        companyId: 1,
        productId: 50,
        productName: "Cabo USB-C",
        productSku: "USB-C",
        unit: "un",
        quantity: "2.000",
        unitPrice: "29.90",
        discountAmount: "0.00",
        totalAmount: "59.80",
        trackStock: true,
        product: { id: 50, name: "Cabo USB-C", sku: "USB-C", active: true },
        identifiers: [],
      },
      {
        id: 102,
        saleId: 4,
        companyId: 1,
        productId: 51,
        productName: "Película",
        productSku: "PEL-1",
        unit: "un",
        quantity: "1.000",
        unitPrice: "29.90",
        discountAmount: "10.00",
        totalAmount: "19.90",
        trackStock: true,
        product: { id: 51, name: "Película", sku: "PEL-1", active: true },
        identifiers: [],
      },
    ],
    ...overrides,
  };
}

function renderReceipt(sale, mode = "dark") {
  const theme = createTheme(getThemeOptions(mode));
  return render(
    <ThemeProvider theme={theme}>
      <SaleReceiptContent sale={sale} layout="screen" branding={null} />
    </ThemeProvider>
  );
}

function jssRulesText() {
  return Array.from(document.querySelectorAll("style"))
    .map((node) => node.textContent || "")
    .join("\n");
}

describe("SaleReceiptContent itens visíveis (shape real + tema escuro)", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  it("getInventorySaleItems preserva o shape real do GET", () => {
    const sale = realGetSalePayload();
    const items = getInventorySaleItems(sale);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 101,
      productName: "Cabo USB-C",
      quantity: "2.000",
      unitPrice: "29.90",
      discountAmount: "0.00",
      totalAmount: "59.80",
    });
  });

  it("renderiza produto, qtd, preço, desconto e total das linhas", () => {
    renderReceipt(realGetSalePayload(), "dark");
    expect(screen.getByTestId("sale-receipt-item-row-101")).toBeTruthy();
    expect(screen.getByTestId("sale-receipt-item-name-101").textContent).toMatch(
      /Cabo USB-C/
    );
    expect(screen.getByTestId("sale-receipt-item-row-102")).toBeTruthy();
    expect(screen.getByText("Produto")).toBeTruthy();
    expect(screen.getByText("Qtd.")).toBeTruthy();
    // Valores monetários / quantidade no corpo
    expect(document.body.textContent).toMatch(/29,90/);
    expect(document.body.textContent).toMatch(/10,00/);
    expect(document.body.textContent).toMatch(/59,80/);
    expect(document.body.textContent).toMatch(/19,90/);
  });

  it("JSS do itemsTable fixa cor escura no td (não só no th)", () => {
    renderReceipt(realGetSalePayload(), "dark");
    const css = jssRulesText();
    // th já tinha #444; td precisa de #111 para não herdar text.primary do tema escuro
    expect(css).toMatch(/color:\s*#444/);
    expect(css).toMatch(/color:\s*#111/);
  });

  it("totais do shape real continuam no recibo", () => {
    renderReceipt(realGetSalePayload(), "dark");
    expect(document.body.textContent).toMatch(/79,70/);
    expect(document.body.textContent).toMatch(/89,70/);
  });
});
