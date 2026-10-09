/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryReceivablesTab from "../InventoryReceivablesTab";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockList = jest.fn();
const mockSummary = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryReceivables: (...a) => mockList(...a),
  getInventoryReceivablesSummary: (...a) => mockSummary(...a),
  getInventoryReceivable: jest.fn(),
  createInventoryReceivablePayment: jest.fn(),
  reverseInventoryReceivablePayment: jest.fn(),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("../../../hooks/useIsMobile", () => () => false);
jest.mock("../../../components/ConfirmationModal", () => () => null);

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canViewReceivables: true,
    canReceiveReceivables: true,
    canReverseReceivablePayments: true,
  }),
}));

describe("InventoryReceivablesTab", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockList.mockReset();
    mockSummary.mockReset();
    mockSummary.mockResolvedValue({
      data: {
        openAmount: 150,
        overdueAmount: 50,
        dueTodayAmount: 25,
        next7DaysAmount: 75,
      },
    });
    mockList.mockResolvedValue({
      data: {
        installments: [
          {
            installmentId: 9,
            receivableId: 3,
            customerName: "Cliente A",
            saleNumber: 10,
            sequence: 1,
            dueDate: "2026-10-15",
            originalAmount: 100,
            paidAmount: 0,
            openAmount: 100,
            displayStatus: "open",
            status: "open",
          },
        ],
        count: 1,
        page: 1,
        limit: 20,
      },
    });
  });

  it("mostra cards de resumo e listagem", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryReceivablesTab />
      </ThemeProvider>
    );

    await waitFor(() => expect(mockSummary).toHaveBeenCalled());
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.getByTestId("receivables-summary-open")).toBeTruthy();
    expect(screen.getByTestId("receivables-summary-overdue")).toBeTruthy();
    expect(await screen.findByText("Cliente A")).toBeTruthy();
    expect(screen.getByTestId("receivable-receive-9")).toBeTruthy();
  });
});
