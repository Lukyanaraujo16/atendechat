/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardSuccess from "../wizard/SaleWizardSuccess";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockGet = jest.fn();
const mockPush = jest.fn();

jest.mock("react-router-dom", () => ({
  useHistory: () => ({ push: mockPush }),
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySale: (...a) => mockGet(...a),
  getInventoryReceiptBranding: jest.fn().mockResolvedValue({ data: {} }),
  getInventorySalePayments: jest.fn(() =>
    Promise.resolve({ data: { payments: [], summary: null } })
  ),
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../../../hooks/useIsMobile", () => () => false);

function completedSale(overrides = {}) {
  return {
    id: 55,
    status: "completed",
    saleNumber: 128,
    paymentMethod: "pix",
    paymentStatus: "paid",
    subtotalAmount: 119.6,
    discountAmount: 0,
    totalAmount: 119.6,
    paidAmount: 119.6,
    cardInstallmentCount: null,
    contact: null,
    seller: { id: 1, name: "João" },
    items: [
      {
        id: 1,
        productName: "Cabo USB",
        productSku: "C1",
        quantity: 2,
        unitPrice: 29.9,
        discountAmount: 0,
        totalAmount: 59.8,
        unit: "un",
      },
      {
        id: 2,
        productName: "Película",
        productSku: "P1",
        quantity: 1,
        unitPrice: 59.8,
        discountAmount: 0,
        totalAmount: 59.8,
        unit: "un",
      },
    ],
    ...overrides,
  };
}

describe("SaleWizardSuccess recibo", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: completedSale() });
  });

  it("10. recibo aberto pelo sucesso contém itens após GET", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleWizardSuccess
          sale={completedSale({ items: [] })}
          onOpenSale={() => {}}
          onNewSale={() => {}}
        />
      </ThemeProvider>
    );

    userEvent.click(screen.getByTestId("sale-wizard-print-receipt"));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(55));
    expect(await screen.findByTestId("sale-receipt-item-row-1")).toBeTruthy();
    expect(screen.getByTestId("sale-receipt-item-name-1").textContent).toMatch(
      /Cabo USB/
    );
    expect(screen.getByTestId("sale-receipt-item-row-2")).toBeTruthy();
    expect(screen.getByText("Produto")).toBeTruthy();
    expect(screen.getByText("Qtd.")).toBeTruthy();
  });

  it("aceita alias InventorySaleItems no payload do GET", async () => {
    mockGet.mockResolvedValue({
      data: completedSale({
        items: undefined,
        InventorySaleItems: completedSale().items,
      }),
    });
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleWizardSuccess
          sale={completedSale({ items: [] })}
          onOpenSale={() => {}}
          onNewSale={() => {}}
        />
      </ThemeProvider>
    );
    userEvent.click(screen.getByTestId("sale-wizard-print-receipt"));
    expect(await screen.findByTestId("sale-receipt-item-name-1")).toBeTruthy();
  });
});
