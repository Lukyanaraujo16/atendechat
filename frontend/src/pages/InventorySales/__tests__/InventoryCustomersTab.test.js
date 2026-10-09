/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryCustomersTab from "../InventoryCustomersTab";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockList = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryCustomers: (...a) => mockList(...a),
  createInventoryCustomer: jest.fn(),
  updateInventoryCustomer: jest.fn(),
  getInventoryCustomer: jest.fn(),
  getInventoryCustomerCredit: jest.fn(),
  listInventoryReceivables: jest.fn().mockResolvedValue({ data: { installments: [] } }),
  activateInventoryCustomer: jest.fn(),
  deactivateInventoryCustomer: jest.fn(),
  searchInventoryContacts: jest.fn().mockResolvedValue({ data: { contacts: [] } }),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("../../../hooks/useIsMobile", () => () => false);

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canViewCustomers: true,
    canManageCustomers: true,
    canViewCustomerFinancials: true,
    canManageCustomerCredit: true,
    canReceiveReceivables: true,
  }),
}));

jest.mock("../InventoryCustomerFormDialog", () => () => null);
jest.mock("../InventoryCustomerAccountDialog", () => () => null);

describe("InventoryCustomersTab", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockList.mockReset();
    mockList.mockResolvedValue({
      data: {
        customers: [
          {
            id: 1,
            name: "Cliente Teste",
            document: "123",
            phone: "1199",
            isActive: true,
            credit: {
              creditLimit: 1000,
              creditUsed: 200,
              creditAvailable: 800,
              overdueOpenAmount: 0,
            },
          },
        ],
        count: 1,
        page: 1,
        limit: 20,
      },
    });
  });

  it("lista clientes e mostra ações", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryCustomersTab />
      </ThemeProvider>
    );

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(await screen.findByText("Cliente Teste")).toBeTruthy();
    expect(screen.getByTestId("inventory-customers-new")).toBeTruthy();
    expect(screen.getByTestId("inventory-customers-search")).toBeTruthy();
  });

  it("filtra por busca", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryCustomersTab />
      </ThemeProvider>
    );
    await screen.findByText("Cliente Teste");
    userEvent.type(screen.getByTestId("inventory-customers-search"), "Cliente");
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Cliente" })
      )
    );
  });
});
