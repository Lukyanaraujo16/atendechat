/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryProductsTab from "../InventoryProductsTab";
import toastError from "../../../errors/toastError";
import { toast } from "react-toastify";
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

let mockPerms = { canManageProducts: true, canDeleteProducts: true };
jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
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
    mockPerms = { canManageProducts: true, canDeleteProducts: true };
    changeLanguage("pt");
    jest.clearAllMocks();
    listInventoryCategories.mockResolvedValue({ data: [] });
    listInventoryProducts.mockResolvedValue({
      data: [activeProduct, inactiveProduct],
    });
    deleteInventoryProduct.mockResolvedValue({});
    updateInventoryProduct.mockResolvedValue({ data: {} });
  });

  it("lixeira abre a confirmação com as consequências e exclui sem desativar", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText("Excluir produto")[0]);
    expect(screen.getByText("Excluir produto permanentemente?")).toBeTruthy();
    expect(
      screen.getByText(
        "O produto será removido definitivamente do catálogo, incluindo suas variantes e movimentações de estoque."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Se houver vendas registradas, o histórico financeiro dessas vendas será preservado, mas o produto não poderá mais ser utilizado em novas operações."
      )
    ).toBeTruthy();
    expect(screen.getByText("Esta ação não poderá ser desfeita.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    const listCallsBefore = listInventoryProducts.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    await waitFor(() => expect(deleteInventoryProduct).toHaveBeenCalledWith(1));
    expect(updateInventoryProduct).not.toHaveBeenCalled();
    // Sucesso: toast e listagem recarregada sem recarregar a página.
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Produto excluído."));
    await waitFor(() => expect(listInventoryProducts.mock.calls.length).toBeGreaterThan(listCallsBefore));
  });

  it("produto inativo também pode ser excluído", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Película")).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText("Excluir produto")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    await waitFor(() => expect(deleteInventoryProduct).toHaveBeenCalledWith(2));
  });

  it("clique duplo na confirmação dispara uma única exclusão", async () => {
    let resolveDelete;
    deleteInventoryProduct.mockImplementation(() => new Promise((r) => { resolveDelete = r; }));
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText("Excluir produto")[0]);
    const confirm = screen.getByRole("button", { name: "Excluir permanentemente" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(deleteInventoryProduct).toHaveBeenCalledTimes(1);
    resolveDelete({});
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("erro do backend na exclusão mostra o erro e mantém o produto na lista", async () => {
    const err = { response: { status: 409, data: { error: "ERR_INVENTORY_PRODUCT_DELETE_CONFLICT" } } };
    deleteInventoryProduct.mockRejectedValue(err);
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText("Excluir produto")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(err));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Capinha")).toBeTruthy();
  });

  it("sem permissão de exclusão definitiva (não admin): lixeira oculta, demais ações mantidas", async () => {
    mockPerms = { canManageProducts: true, canDeleteProducts: false };
    renderTab();
    await waitFor(() => expect(screen.getByText("Capinha")).toBeTruthy());
    expect(screen.queryByLabelText("Excluir produto")).toBeNull();
    expect(screen.getByLabelText("Desativar produto")).toBeTruthy();
    expect(screen.getByLabelText("Reativar produto")).toBeTruthy();
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
    fireEvent.click(screen.getAllByLabelText("Excluir produto")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });
});
