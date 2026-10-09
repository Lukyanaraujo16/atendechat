/**
 * @jest-environment jsdom
 */
import React, { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardPaymentStep from "../wizard/SaleWizardPaymentStep";

const mockGetPayments = jest.fn();
const mockUpdateGlobal = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySalePayments: (...a) => mockGetPayments(...a),
  updateInventorySaleGlobalDiscount: (...a) => mockUpdateGlobal(...a),
  addInventorySalePayment: jest.fn(),
  deleteInventorySalePaymentLine: jest.fn(),
  settleInventorySalePaymentLine: jest.fn(),
  getInventoryCustomerCredit: jest.fn(),
  previewInventoryStoreCreditSchedule: jest.fn(),
}));
jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
    canApplyDiscount: true,
    canUseStoreCredit: false,
  }),
}));

function Harness() {
  const [sale, setSale] = useState({
    id: 25,
    status: "draft",
    items: [{ id: 1, productName: "Capinha", quantity: 1, totalAmount: 29.9 }],
    subtotalAmount: 29.9,
    discountAmount: 0,
    globalDiscountType: null,
    globalDiscountPercent: null,
    globalDiscountAmount: 0,
    freightAmount: 0,
    totalAmount: 29.9,
  });
  const [paymentsBundle, setPaymentsBundle] = useState(null);

  return (
    <ThemeProvider theme={createTheme()}>
      <SaleWizardPaymentStep
        sale={sale}
        canManagePayments
        disabled={false}
        paymentsBundle={paymentsBundle}
        setPaymentsBundle={setPaymentsBundle}
        onSaleCacheMaybeChanged={jest.fn()}
        onSaleUpdated={async () => {
          setSale((prev) => ({
            ...prev,
            globalDiscountType: "fixed",
            globalDiscountAmount: 0.3,
            totalAmount: 29.6,
          }));
        }}
        canApplyDiscount
      />
    </ThemeProvider>
  );
}

describe("SaleWizardPaymentStep sync após desconto global", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetPayments.mockReset();
    mockUpdateGlobal.mockReset();
    mockGetPayments.mockResolvedValue({
      data: {
        payments: [],
        summary: {
          totalAmount: 29.9,
          effectivePaid: 0,
          pendingAmount: 0,
          remainingToAllocate: 29.9,
        },
      },
    });
    mockUpdateGlobal.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("total e falta distribuir acompanham sale.totalAmount após desconto", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("sale-wizard-payment-total")).toBeTruthy()
    );

    // Antes do update do sale, display já usa sale.totalAmount (29,90)
    expect(screen.getByTestId("sale-wizard-payment-total").textContent).toMatch(
      /29[,.]90/
    );
    expect(
      screen.getByTestId("sale-wizard-payment-remaining").textContent
    ).toMatch(/29[,.]90/);

    // Operador aplica R$ 0,30
    fireEvent.click(screen.getByTestId("global-discount-type-fixed"));
    const amount = screen.getByTestId("global-discount-amount");
    for (let i = 0; i < 6; i += 1) {
      fireEvent.keyDown(amount, { key: "Backspace" });
    }
    fireEvent.keyDown(amount, { key: "3" });
    fireEvent.keyDown(amount, { key: "0" });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => expect(mockUpdateGlobal).toHaveBeenCalled());

    await waitFor(() => {
      expect(
        screen.getByTestId("sale-wizard-payment-total").textContent
      ).toMatch(/29[,.]60/);
      expect(
        screen.getByTestId("sale-wizard-payment-remaining").textContent
      ).toMatch(/29[,.]60/);
    });
  });
});
