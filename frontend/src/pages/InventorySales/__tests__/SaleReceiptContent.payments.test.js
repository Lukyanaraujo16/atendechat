/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptContent from "../SaleReceiptContent";
import { getThemeOptions } from "../../../theme/appThemeOptions";
import { SALE_RECEIPT_PRINT_FORMATS } from "../saleReceiptPrintFormats";

jest.mock("../../../hooks/useIsMobile", () => () => false);

function baseSale(overrides = {}) {
  return {
    id: 4,
    status: "completed",
    saleNumber: 4,
    paymentStatus: "paid",
    paymentMethod: null,
    subtotalAmount: 1000,
    discountAmount: 0,
    totalAmount: 1000,
    paidAmount: 1000,
    completedAt: "2026-10-07T14:00:00.000Z",
    contact: { name: "Cliente" },
    seller: { name: "Vendedor" },
    items: [
      {
        id: 1,
        productName: "Item",
        quantity: 1,
        unitPrice: 1000,
        discountAmount: 0,
        totalAmount: 1000,
      },
    ],
    ...overrides,
  };
}

function renderReceipt({ sale, payments, paymentSummary, format, mode = "dark" }) {
  const theme = createTheme(getThemeOptions(mode));
  return render(
    <ThemeProvider theme={theme}>
      <SaleReceiptContent
        sale={sale}
        layout={format ? "print" : "screen"}
        format={format}
        payments={payments}
        paymentSummary={paymentSummary}
      />
    </ThemeProvider>
  );
}

describe("SaleReceiptContent pagamentos", () => {
  beforeEach(() => {
    changeLanguage("pt");
  });

  it("single payment lista a line", () => {
    renderReceipt({
      sale: baseSale({ paymentMethod: "pix" }),
      payments: [
        {
          id: 1,
          method: "pix",
          amount: 1000,
          status: "paid",
        },
      ],
      paymentSummary: {
        effectivePaid: 1000,
        pendingAmount: 0,
      },
    });
    expect(screen.getByTestId("receipt-payments")).toBeTruthy();
    expect(screen.getByTestId("receipt-payment-line-1").textContent).toMatch(/PIX/);
    expect(screen.getByTestId("receipt-payment-line-1").textContent).toMatch(/Pago/);
    expect(screen.queryByText(/Múltiplas formas/)).toBeNull();
  });

  it("cash+pix+card com parcelas", () => {
    renderReceipt({
      sale: baseSale(),
      payments: [
        { id: 1, method: "cash", amount: 200, status: "paid" },
        { id: 2, method: "pix", amount: 300, status: "paid" },
        {
          id: 3,
          method: "credit_card",
          amount: 500,
          status: "paid",
          cardInstallmentCount: 5,
        },
      ],
      paymentSummary: { effectivePaid: 1000, pendingAmount: 0 },
    });
    expect(screen.getByTestId("receipt-payment-line-1").textContent).toMatch(/Dinheiro/);
    expect(screen.getByTestId("receipt-payment-line-2").textContent).toMatch(/PIX/);
    expect(screen.getByTestId("receipt-payment-line-3").textContent).toMatch(
      /Cartão de crédito — 5x/
    );
    expect(screen.queryByText(/Múltiplas formas de pagamento/)).toBeNull();
  });

  it("pending aparece explicitamente", () => {
    renderReceipt({
      sale: baseSale({
        paymentStatus: "partial",
        paidAmount: 200,
      }),
      payments: [
        { id: 1, method: "cash", amount: 200, status: "paid" },
        { id: 2, method: "boleto", amount: 800, status: "pending" },
      ],
      paymentSummary: { effectivePaid: 200, pendingAmount: 800 },
    });
    expect(screen.getByTestId("receipt-payment-line-2").textContent).toMatch(/Pendente/);
    expect(screen.getByTestId("receipt-payment-line-2").textContent).toMatch(/Boleto/);
  });

  it("fallback legado sem lines usa paymentMethod", () => {
    renderReceipt({
      sale: baseSale({ paymentMethod: "pix", paidAmount: 1000 }),
      payments: [],
    });
    expect(screen.queryByTestId("receipt-payments")).toBeNull();
    expect(screen.getByText("PIX")).toBeTruthy();
  });

  it("multi não imprime método único falso", () => {
    renderReceipt({
      sale: baseSale({ paymentMethod: null, paidAmount: 1000 }),
      payments: [
        { id: 1, method: "cash", amount: 400, status: "paid" },
        { id: 2, method: "pix", amount: 600, status: "paid" },
      ],
      paymentSummary: { effectivePaid: 1000, pendingAmount: 0 },
    });
    expect(screen.queryByText(/Múltiplas formas de pagamento/)).toBeNull();
    expect(screen.getByTestId("receipt-payment-line-1")).toBeTruthy();
    expect(screen.getByTestId("receipt-payment-line-2")).toBeTruthy();
  });

  it("dark theme mantém texto escuro nas lines", () => {
    renderReceipt({
      sale: baseSale(),
      payments: [{ id: 1, method: "pix", amount: 1000, status: "paid" }],
      paymentSummary: { effectivePaid: 1000, pendingAmount: 0 },
      mode: "dark",
    });
    const line = screen.getByTestId("receipt-payment-line-1");
    const style = window.getComputedStyle(line.querySelector("span") || line);
    // Cor do texto não deve ser branco puro do tema escuro
    expect(style.color === "rgb(255, 255, 255)" || style.color === "#fff").toBe(
      false
    );
  });

  it.each([
    ["a4", null],
    ["thermal80", SALE_RECEIPT_PRINT_FORMATS.thermal80],
    ["thermal58", SALE_RECEIPT_PRINT_FORMATS.thermal58],
  ])("%s contém payment lines", (_label, format) => {
    renderReceipt({
      sale: baseSale(),
      format,
      payments: [
        { id: 1, method: "cash", amount: 200, status: "paid" },
        { id: 2, method: "pix", amount: 800, status: "paid" },
      ],
      paymentSummary: { effectivePaid: 1000, pendingAmount: 0 },
    });
    expect(screen.getByTestId("receipt-payments")).toBeTruthy();
    expect(screen.getByTestId("receipt-payment-line-1").textContent).toMatch(/Dinheiro/);
    expect(screen.getByTestId("receipt-payment-line-2").textContent).toMatch(/PIX/);
  });
});
