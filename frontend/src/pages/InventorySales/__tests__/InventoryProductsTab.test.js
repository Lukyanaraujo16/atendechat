/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryProductsTab from "../InventoryProductsTab";
import {
  deleteInventoryProduct,
  listInventoryCategories,
  listInventoryProducts,
  updateInventoryProduct,
} from "../../../services/inventoryApi";

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryCategories: jest.fn(),
  listInventoryProducts: jest.fn(),
  deleteInventoryProduct: jest.fn(),
  updateInventoryProduct: jest.fn(),
}));

jest.mock("../../../hooks/useIsMobile", () => jest.fn(() => false));

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({ canManageProducts: true }),
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

const theme = createTheme();

const activeProduct = {
  id: 1,
  name: "Capinha",
  sku: "CAP",
  salePrice: 10,
  active: true,
  trackStock: false,
};

const inactiveProduct = {
  ...activeProduct,
  id: 2,
  name: "Película",
  active: false,
};

function renderTab() {
  return render(
    <ThemeProvider theme={theme}>
      <InventoryProductsTab />
    </ThemeProvider>
  );
}

describe("InventoryProductsTab exclusão e estado", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    listInventoryCategories.mockResolvedValue({ data: [] });
    listInventoryProducts.mockResolvedValue({
      data: [activeProduct, inactiveProduct],
    });
    deleteInventoryProduct.mockResolvedValue({});
    updateInventoryProduct.mockResolvedValue({ data: {} });
  });

  it("lixeira confirma exclusão definitiva e não desativa", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    const deleteButtons = screen.getAllByLabelText("Excluir definitivamente");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Excluir produto?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() =>
      expect(deleteInventoryProduct).toHaveBeenCalledWith(1)
    );
    expect(updateInventoryProduct).not.toHaveBeenCalled();
  });

  it("desativar usa updateInventoryProduct com active false", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Desativar produto"));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    await waitFor(() =>
      expect(updateInventoryProduct).toHaveBeenCalledWith(1, { active: false })
    );
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });

  it("reativar produto inativo", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Película")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Reativar produto"));
    await waitFor(() =>
      expect(updateInventoryProduct).toHaveBeenCalledWith(2, { active: true })
    );
  });

  it("cancelar exclusão não chama a API", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText("Excluir definitivamente")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });
});
