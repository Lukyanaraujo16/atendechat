/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleItemsEditor from "../SaleItemsEditor";

jest.mock("../../../services/inventoryApi", () => ({
  updateInventorySaleItem: jest.fn(),
  deleteInventorySaleItem: jest.fn(),
  addInventorySaleItem: jest.fn(),
  listInventoryProducts: jest.fn(() => Promise.resolve({ data: [] })),
}));
jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../hooks/useIsMobile", () => () => false);
jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
  }),
}));

describe("SaleItemsEditor discount toggle", () => {
  beforeAll(() => changeLanguage("pt"));

  it("switches row discount input between R$ and %", () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            items: [
              {
                id: 5,
                productName: "P",
                quantity: 1,
                unitPrice: 50,
                discountType: "fixed",
                discountAmount: 0,
                totalAmount: 50,
                identifiers: [],
              },
            ],
          }}
          readOnly={false}
          autoSave={false}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId("sale-item-discount-5-amount")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    expect(screen.getByTestId("sale-item-discount-5-percent")).toBeTruthy();
  });
});
