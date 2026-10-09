/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptContent from "../SaleReceiptContent";
import { getThemeOptions } from "../../../theme/appThemeOptions";

jest.mock("../../../hooks/useIsMobile", () => () => false);

function renderReceipt(sale) {
  const theme = createTheme(getThemeOptions("dark"));
  return render(
    <ThemeProvider theme={theme}>
      <SaleReceiptContent sale={sale} layout="screen" />
    </ThemeProvider>
  );
}

describe("SaleReceiptContent discount display", () => {
  beforeAll(() => changeLanguage("pt"));

  it("shows percentage item discount and global discount line", () => {
    renderReceipt({
      id: 1,
      status: "completed",
      saleNumber: 1,
      subtotalAmount: 300,
      discountAmount: 30,
      globalDiscountAmount: 10,
      freightAmount: 0,
      totalAmount: 260,
      paidAmount: 260,
      items: [
        {
          id: 9,
          productName: "Prod",
          quantity: 3,
          unitPrice: 100,
          discountType: "percentage",
          discountPercent: 10,
          discountAmount: 30,
          totalAmount: 270,
        },
      ],
    });
    expect(screen.getByTestId("sale-receipt-item-row-9").textContent).toMatch(
      /10%\s*\(R\$\s*30/
    );
    expect(screen.getByTestId("receipt-global-discount-line")).toBeTruthy();
  });

  it("legacy item without discountType shows currency only", () => {
    renderReceipt({
      id: 2,
      status: "completed",
      saleNumber: 2,
      subtotalAmount: 100,
      discountAmount: 10,
      globalDiscountAmount: 0,
      totalAmount: 90,
      paidAmount: 90,
      items: [
        {
          id: 3,
          productName: "Legado",
          quantity: 1,
          unitPrice: 100,
          discountAmount: 10,
          totalAmount: 90,
        },
      ],
    });
    const row = screen.getByTestId("sale-receipt-item-row-3");
    expect(row.textContent).toMatch(/R\$\s*10/);
    expect(row.textContent).not.toMatch(/%/);
  });
});
