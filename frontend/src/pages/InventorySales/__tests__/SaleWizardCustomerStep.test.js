/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardCustomerStep from "../wizard/SaleWizardCustomerStep";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockSearch = jest.fn().mockResolvedValue({ data: { customers: [] } });

jest.mock("../../../services/inventoryApi", () => ({
  searchInventoryCustomers: (...a) => mockSearch(...a),
  searchInventoryContacts: jest.fn().mockResolvedValue({ data: { contacts: [] } }),
  createInventoryCustomer: jest.fn(),
  createInventoryCustomerFromContact: jest.fn(),
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [{ id: 1, name: "Seller" }] }),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canManageCustomers: true,
    canManageCustomerCredit: true,
  }),
}));

jest.mock("../InventoryCustomerFormDialog", () => () => null);

function renderStep(props = {}) {
  const headerForm = {
    contactId: "",
    customerId: "",
    sellerUserId: "1",
    notes: "",
  };
  const setHeaderForm = jest.fn();
  const setSelectedCustomer = jest.fn();
  const setWalkIn = jest.fn();

  render(
    <ThemeProvider theme={createTheme()}>
      <SaleWizardCustomerStep
        sale={{ id: 1, status: "draft", contactId: null, customerId: null }}
        headerForm={headerForm}
        setHeaderForm={setHeaderForm}
        selectedCustomer={props.selectedCustomer ?? null}
        setSelectedCustomer={setSelectedCustomer}
        walkIn={props.walkIn ?? false}
        setWalkIn={setWalkIn}
        users={[{ id: 1, name: "Seller" }]}
        setUsers={jest.fn()}
        disabled={false}
        {...props}
      />
    </ThemeProvider>
  );

  return { setWalkIn, setSelectedCustomer };
}

describe("SaleWizardCustomerStep", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockSearch.mockClear();
  });

  it("renderiza busca de cliente comercial", () => {
    renderStep();
    expect(screen.getByTestId("sale-wizard-customer-search")).toBeTruthy();
    expect(screen.getByTestId("sale-wizard-new-customer")).toBeTruthy();
  });

  it("permite venda sem cliente (walk-in)", () => {
    const { setWalkIn } = renderStep();
    userEvent.click(screen.getByTestId("sale-wizard-walk-in"));
    expect(setWalkIn).toHaveBeenCalledWith(true);
  });

  it("mostra cliente selecionado", () => {
    renderStep({
      selectedCustomer: {
        id: 10,
        name: "Maria Silva",
        phone: "1199",
        creditAvailable: 500,
      },
      walkIn: false,
    });
    expect(screen.getByTestId("sale-wizard-customer-selected").textContent).toContain(
      "Maria Silva"
    );
  });
});
