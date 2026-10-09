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
    canApplyDiscount: true,
  }),
}));

describe("SaleItemsEditor quantity display", () => {
  beforeAll(() => changeLanguage("pt"));

  it("DECIMAL '1.000' da API aparece como 1 no input (não 1.000)", () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 23,
            status: "draft",
            items: [
              {
                id: 9,
                productName: "capinha iphone",
                quantity: "1.000",
                unitPrice: 29.9,
                discountType: "fixed",
                discountAmount: 0,
                totalAmount: 29.9,
                identifiers: [],
              },
            ],
          }}
          readOnly={false}
          autoSave={false}
        />
      </ThemeProvider>
    );
    expect(screen.getByTestId("sale-item-qty-9").value).toBe("1");
  });

  it("quantidade 1000 aparece como 1000", () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            items: [
              {
                id: 2,
                productName: "P",
                quantity: 1000,
                unitPrice: 1,
                discountAmount: 0,
                totalAmount: 1000,
                identifiers: [],
              },
            ],
          }}
          readOnly={false}
          autoSave={false}
        />
      </ThemeProvider>
    );
    expect(screen.getByTestId("sale-item-qty-2").value).toBe("1000");
  });

  it("blur normaliza 1.500 → 1.5 sem alterar payload semântico", () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            items: [
              {
                id: 3,
                productName: "P",
                quantity: "1.500",
                unitPrice: 10,
                discountAmount: 0,
                totalAmount: 15,
                identifiers: [],
              },
            ],
          }}
          readOnly={false}
          autoSave={false}
        />
      </ThemeProvider>
    );
    const input = screen.getByTestId("sale-item-qty-3");
    expect(input.value).toBe("1.5");
    fireEvent.change(input, { target: { value: "2.000" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("sale-item-qty-3").value).toBe("2");
  });

  it("digitação intermediária não é forçada a cada tecla", () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            items: [
              {
                id: 4,
                productName: "P",
                quantity: 1,
                unitPrice: 10,
                discountAmount: 0,
                totalAmount: 10,
                identifiers: [],
              },
            ],
          }}
          readOnly={false}
          autoSave={false}
        />
      </ThemeProvider>
    );
    const input = screen.getByTestId("sale-item-qty-4");
    fireEvent.change(input, { target: { value: "1." } });
    expect(screen.getByTestId("sale-item-qty-4").value).toBe("1.");
  });
});
