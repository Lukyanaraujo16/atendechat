/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardTotals from "../wizard/SaleWizardTotals";

function renderTotals(sale) {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <SaleWizardTotals sale={sale} itemCount={1} />
    </ThemeProvider>
  );
}

describe("SaleWizardTotals global discount line", () => {
  beforeAll(() => changeLanguage("pt"));

  it("shows global discount when amount > 0", () => {
    renderTotals({
      subtotalAmount: 1000,
      discountAmount: 100,
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      globalDiscountAmount: 90,
      freightAmount: 0,
      totalAmount: 810,
    });
    expect(screen.getByTestId("sale-wizard-global-discount-line")).toBeTruthy();
    expect(screen.getByTestId("sale-wizard-total").textContent).toMatch(/810/);
  });

  it("hides global discount line when zero", () => {
    renderTotals({
      subtotalAmount: 100,
      discountAmount: 0,
      globalDiscountAmount: 0,
      freightAmount: 0,
      totalAmount: 100,
    });
    expect(screen.queryByTestId("sale-wizard-global-discount-line")).toBeNull();
  });
});
