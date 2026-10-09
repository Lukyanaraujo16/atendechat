/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardPaymentStep from "../wizard/SaleWizardPaymentStep";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockGetPayments = jest.fn();
const mockAddPayment = jest.fn();
const mockCredit = jest.fn();
const mockPreview = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySalePayments: (...a) => mockGetPayments(...a),
  addInventorySalePayment: (...a) => mockAddPayment(...a),
  deleteInventorySalePaymentLine: jest.fn(),
  settleInventorySalePaymentLine: jest.fn(),
  getInventoryCustomerCredit: (...a) => mockCredit(...a),
  previewInventoryStoreCreditSchedule: (...a) => mockPreview(...a),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canUseStoreCredit: true,
    canAuthorizeStoreCreditOverride: true,
  }),
}));

describe("SaleWizardPaymentStep store credit", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockGetPayments.mockReset();
    mockAddPayment.mockReset();
    mockCredit.mockReset();
    mockPreview.mockReset();
    mockGetPayments.mockResolvedValue({
      data: {
        payments: [
          { id: 1, method: "store_credit", amount: 100, status: "pending" },
        ],
        summary: {
          totalAmount: 100,
          effectivePaid: 0,
          pendingAmount: 100,
          remainingToAllocate: 0,
        },
      },
    });
    mockCredit.mockResolvedValue({
      data: {
        creditLimit: 500,
        creditUsed: 0,
        creditAvailable: 500,
        openAmount: 0,
        overdueOpenAmount: 0,
      },
    });
    mockPreview.mockResolvedValue({
      data: {
        installments: [{ sequence: 1, dueDate: "2026-11-01", amount: 100 }],
        total: 100,
      },
    });
  });

  it("mostra painel de Crédito da Loja quando há linha store_credit", async () => {
    const schedule = {
      frequency: "monthly",
      installmentCount: 2,
      firstDueDate: "2026-11-01",
    };

    render(
      <ThemeProvider theme={createTheme()}>
        <SaleWizardPaymentStep
          sale={{ id: 1, totalAmount: 100 }}
          canManagePayments
          disabled={false}
          paymentsBundle={{
            payments: [
              { id: 1, method: "store_credit", amount: 100, status: "pending" },
            ],
            summary: {
              totalAmount: 100,
              effectivePaid: 0,
              pendingAmount: 100,
              remainingToAllocate: 0,
            },
          }}
          setPaymentsBundle={jest.fn()}
          customerId="7"
          storeCreditSchedule={schedule}
          setStoreCreditSchedule={jest.fn()}
          storeCreditOverride={{ authorizeOverride: false, reason: "" }}
          setStoreCreditOverride={jest.fn()}
        />
      </ThemeProvider>
    );

    expect(await screen.findByTestId("sale-wizard-store-credit-panel")).toBeTruthy();
    expect(screen.getAllByText("Crédito da Loja").length).toBeGreaterThan(0);
    await waitFor(() => expect(mockCredit).toHaveBeenCalledWith("7"));
    expect(screen.getByTestId("store-credit-frequency")).toBeTruthy();
  });

  it("inclui store_credit nas formas de pagamento do módulo", () => {
    const { PAYMENT_METHODS } = require("../constants");
    expect(PAYMENT_METHODS).toContain("store_credit");
    const { RECEIVABLE_COLLECTION_METHODS } = require("../constants");
    expect(RECEIVABLE_COLLECTION_METHODS).not.toContain("store_credit");
  });

  it("ACHADO 3: Nº de parcelas aceita digitação pelo teclado", async () => {
    function Harness() {
      const [schedule, setSchedule] = React.useState({
        frequency: "monthly",
        installmentCount: 2,
        firstDueDate: "2026-11-01",
      });
      return (
        <SaleWizardPaymentStep
          sale={{ id: 1, totalAmount: 100 }}
          canManagePayments
          disabled={false}
          paymentsBundle={{
            payments: [
              { id: 1, method: "store_credit", amount: 100, status: "pending" },
            ],
            summary: {
              totalAmount: 100,
              effectivePaid: 0,
              pendingAmount: 100,
              remainingToAllocate: 0,
            },
          }}
          setPaymentsBundle={jest.fn()}
          customerId="7"
          storeCreditSchedule={schedule}
          setStoreCreditSchedule={setSchedule}
          storeCreditOverride={{ authorizeOverride: false, reason: "" }}
          setStoreCreditOverride={jest.fn()}
        />
      );
    }

    render(
      <ThemeProvider theme={createTheme()}>
        <Harness />
      </ThemeProvider>
    );

    const input = await screen.findByTestId("store-credit-installments");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "6" } });
    expect(input.value).toBe("6");
    // Digitação multi-dígito (1 → 10) sem estados intermediários serem perdidos
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "10" } });
    expect(input.value).toBe("10");
    fireEvent.blur(input);
    expect(input.value).toBe("10");
  });

  it("M3: sem customerId não oferece settle de store_credit e mostra hint desabilitado", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <SaleWizardPaymentStep
          sale={{ id: 1, totalAmount: 100 }}
          canManagePayments
          disabled={false}
          paymentsBundle={{
            payments: [
              { id: 1, method: "store_credit", amount: 100, status: "pending" },
            ],
            summary: {
              totalAmount: 100,
              effectivePaid: 0,
              pendingAmount: 100,
              remainingToAllocate: 0,
            },
          }}
          setPaymentsBundle={jest.fn()}
          customerId={null}
          storeCreditSchedule={{
            frequency: "once",
            installmentCount: 1,
            firstDueDate: "2026-11-01",
          }}
          setStoreCreditSchedule={jest.fn()}
          storeCreditOverride={{ authorizeOverride: false, reason: "" }}
          setStoreCreditOverride={jest.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByTestId("wizard-payment-settle-1")).toBeNull();
    const addBtn = await screen.findByTestId("sale-wizard-payment-add");
    await userEvent.click(addBtn);
    expect(
      await screen.findByText(/exige.*cliente cadastrado/i)
    ).toBeTruthy();
  });
});
