/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import NewSaleRedirectPage from "../NewSaleRedirectPage";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../components/MainContainer", () => ({ children }) => (
  <div>{children}</div>
));

const mockReplace = jest.fn();
const mockCreate = jest.fn();

jest.mock("react-router-dom", () => ({
  useHistory: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("../../../context/Auth/AuthContext", () => {
  const { createContext } = require("react");
  return {
    AuthContext: createContext({ user: { id: 7, name: "João" } }),
  };
});

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    loaded: true,
    canCreateSale: true,
  }),
}));

jest.mock("../../../services/inventoryApi", () => ({
  createInventorySale: (...args) => mockCreate(...args),
}));

jest.mock("../../../errors/toastError", () => jest.fn());

describe("NewSaleRedirectPage", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ data: { id: 55 } });
  });

  it("cria draft com seller logado e redireciona uma vez", async () => {
    render(<NewSaleRedirectPage />);
    expect(screen.getByTestId("sale-wizard-creating")).toBeTruthy();
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
    expect(mockCreate).toHaveBeenCalledWith({
      source: "manual",
      sellerUserId: 7,
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/inventory-sales/sales/55");
    });
  });
});
