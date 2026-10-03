import React from "react";
import { render, screen } from "@testing-library/react";

import InventorySales from "../index";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canView: false,
    canManageProducts: false,
    canManageStock: false,
    canCreateSale: false,
    canViewReports: false,
    canManageSettings: false,
  }),
}));

describe("cabeçalho do módulo Estoque e Vendas", () => {
  it("renderiza título e descrição em elementos separados", () => {
    render(<InventorySales />);
    const title = screen.getByRole("heading", { name: "Estoque e Vendas" });
    const subtitle = screen.getByText(
      "Gerencie produtos, categorias, estoque e configurações do módulo."
    );
    expect(title.tagName).toBe("H1");
    expect(subtitle.tagName).toBe("P");
    expect(title).not.toBe(subtitle);
    expect(title.textContent).not.toContain(subtitle.textContent);
  });
});
