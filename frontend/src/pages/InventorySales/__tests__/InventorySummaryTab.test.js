import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import InventorySummaryTab from "../InventorySummaryTab";
import { ManualSaleProvider } from "../ManualSaleProvider";
import { INVENTORY_TABS } from "../constants";

const mockHistoryPush = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useHistory: () => ({
      push: mockHistoryPush,
      replace: jest.fn(),
    }),
  };
});

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockListInventoryProducts = jest.fn();
const mockListInventoryCategories = jest.fn();
const mockListLowStockProducts = jest.fn();
const mockListInventorySales = jest.fn();
const mockCreateInventorySale = jest.fn();

jest.mock("../../../services/inventoryApi", () => {
  const actual = jest.requireActual("../../../services/inventoryApi");
  return {
    ...actual,
    listInventoryProducts: (...args) => mockListInventoryProducts(...args),
    listInventoryCategories: (...args) => mockListInventoryCategories(...args),
    listLowStockProducts: (...args) => mockListLowStockProducts(...args),
    listInventorySales: (...args) => mockListInventorySales(...args),
    createInventorySale: (...args) => mockCreateInventorySale(...args),
  };
});

const mockPerms = {
  canCreateSale: true,
  canManageProducts: true,
  canManageStock: true,
  canViewReports: false,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockNavigateTab = jest.fn();

function renderSummary() {
  return render(
    <MemoryRouter>
      <ManualSaleProvider>
        <InventorySummaryTab
          onNavigateTab={mockNavigateTab}
          onNewProduct={jest.fn()}
          onNewMovement={jest.fn()}
        />
      </ManualSaleProvider>
    </MemoryRouter>
  );
}

describe("aba Resumo", () => {
  beforeEach(() => {
    mockNavigateTab.mockClear();
    mockHistoryPush.mockClear();
    mockPerms.canCreateSale = true;
    mockPerms.canManageProducts = true;
    mockPerms.canManageStock = true;
    mockListInventoryProducts.mockResolvedValue({ data: [{ id: 1 }] });
    mockListInventoryCategories.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    mockListLowStockProducts.mockResolvedValue({ data: [] });
    mockListInventorySales.mockResolvedValue({
      data: {
        sales: [
          {
            id: 9,
            saleNumber: 9,
            status: "completed",
            totalAmount: 10,
            createdAt: "2026-10-01T12:00:00.000Z",
            contact: { name: "Ana" },
            seller: { name: "Lia" },
          },
        ],
      },
    });
    mockCreateInventorySale.mockResolvedValue({ data: { id: 44 } });
  });

  it("mostra Nova venda com createSale e pede só cinco vendas", async () => {
    renderSummary();
    expect(await screen.findByText("Nova venda")).toBeTruthy();
    expect(screen.getByText("Novo produto")).toBeTruthy();
    expect(screen.getByText("Entrada / ajuste")).toBeTruthy();
    await waitFor(() => {
      expect(mockListInventorySales).toHaveBeenCalledWith({ page: 1, limit: 5 });
    });
    expect(await screen.findByText(/Ana/)).toBeTruthy();
    expect(screen.getByText("Concluída")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText(/totalSold|totalPaid|totalPending/)).toBeNull();
    userEvent.click(screen.getByText("Ver todas"));
    expect(mockNavigateTab).toHaveBeenCalledWith(INVENTORY_TABS.SALES);
    userEvent.click(screen.getByText("Ver movimentações"));
    expect(mockNavigateTab).toHaveBeenCalledWith(INVENTORY_TABS.STOCK);
  });

  it("oculta Nova venda sem createSale e respeita as outras permissões", async () => {
    mockPerms.canCreateSale = false;
    mockPerms.canManageProducts = false;
    mockPerms.canManageStock = false;
    mockListInventorySales.mockResolvedValue({ data: { sales: [] } });
    renderSummary();
    expect(await screen.findByText("Nenhuma venda recente.")).toBeTruthy();
    expect(screen.queryByText("Nova venda")).toBeNull();
    expect(screen.queryByText("Novo produto")).toBeNull();
    expect(screen.queryByText("Entrada / ajuste")).toBeNull();
    expect(screen.getByText("Ver movimentações")).toBeTruthy();
    expect(screen.getByText("Nenhum produto com estoque baixo no momento.")).toBeTruthy();
  });

  it("mostra retry quando as vendas recentes falham", async () => {
    mockListInventorySales.mockRejectedValue(new Error("fail"));
    renderSummary();
    expect(await screen.findByText("Não foi possível carregar as vendas recentes.")).toBeTruthy();
    expect(screen.getByText("Produtos ativos")).toBeTruthy();
    mockListInventorySales.mockResolvedValue({ data: { sales: [] } });
    userEvent.click(screen.getByText("Tentar novamente"));
    expect(await screen.findByText("Nenhuma venda recente.")).toBeTruthy();
  });

  it("abre o wizard de nova venda", async () => {
    renderSummary();
    const button = await screen.findByText("Nova venda");
    userEvent.click(button);
    await waitFor(() => {
      expect(mockHistoryPush).toHaveBeenCalledWith("/inventory-sales/new");
    });
    expect(mockCreateInventorySale).not.toHaveBeenCalled();
  });
});
