/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardPage from "../SaleWizardPage";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../components/MainContainer", () => ({ children }) => (
  <div data-testid="main">{children}</div>
));

jest.mock("../../../components/ConfirmationModal", () => ({ open, onConfirm, children }) =>
  open ? (
    <div data-testid="confirm-modal">
      {children}
      <button type="button" onClick={onConfirm}>
        ok
      </button>
    </div>
  ) : null
);

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockGetPayments = jest.fn();
const mockAddPayment = jest.fn();
const mockUpdateDelivery = jest.fn();
const mockComplete = jest.fn();
const mockDelete = jest.fn();
const mockPush = jest.fn();

jest.mock("react-router-dom", () => ({
  useParams: () => ({ saleId: "12" }),
  useHistory: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("../../../context/Auth/AuthContext", () => {
  const { createContext } = require("react");
  return {
    AuthContext: createContext({ user: { id: 3, name: "João" } }),
  };
});

const mockPerms = {
  loaded: true,
  canCreateSale: true,
  canManagePayments: true,
  canCancelSale: true,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySale: (...a) => mockGet(...a),
  updateInventorySale: (...a) => mockUpdate(...a),
  getInventorySalePayments: (...a) => mockGetPayments(...a),
  addInventorySalePayment: (...a) => mockAddPayment(...a),
  updateInventorySalePaymentLine: jest.fn(),
  deleteInventorySalePaymentLine: jest.fn(),
  settleInventorySalePaymentLine: jest.fn(),
  updateInventorySaleDelivery: (...a) => mockUpdateDelivery(...a),
  completeInventorySale: (...a) => mockComplete(...a),
  deleteInventorySale: (...a) => mockDelete(...a),
  searchInventoryCustomers: jest.fn().mockResolvedValue({ data: { customers: [] } }),
  listInventoryProducts: jest.fn().mockResolvedValue({ data: [] }),
  listInventoryDeliveryMethods: jest.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        name: "Retirada na loja",
        kind: "pickup",
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false,
        active: true,
      },
    ],
  }),
  addInventorySaleItem: jest.fn(),
  updateInventorySaleItem: jest.fn(),
  deleteInventorySaleItem: jest.fn(),
  getInventoryReceiptBranding: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock("../wizard/SaleWizardDeliveryStep", () => {
  const React = require("react");
  return React.forwardRef(function MockDelivery(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      persist: async () => {
        const res = await mockUpdateDelivery(12, { deliveryMethodId: 1 });
        return res.data;
      },
    }));
    return <div data-testid="sale-wizard-delivery-step">entrega mock</div>;
  });
});

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      data: [{ id: 3, name: "João" }, { id: 9, name: "Maria" }],
    }),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../SaleItemsEditor", () => {
  return function MockItems({ sale }) {
    return (
      <div data-testid="mock-items">
        itens:{Array.isArray(sale?.items) ? sale.items.length : 0}
      </div>
    );
  };
});

jest.mock("../SaleDrawer", () => () => null);
jest.mock("../SaleReceiptDialog", () => () => null);

function draftSale(overrides = {}) {
  return {
    id: 12,
    status: "draft",
    saleNumber: -12,
    contactId: null,
    sellerUserId: 3,
    notes: null,
    paymentMethod: null,
    cardInstallmentCount: null,
    paymentNotes: null,
    subtotalAmount: 100,
    discountAmount: 0,
    totalAmount: 100,
    freightAmount: 0,
    deliveryMethodId: null,
    deliveryMethodName: null,
    deliveryKind: null,
    paidAmount: 0,
    items: [{ id: 1, productName: "Cabo", quantity: 1, totalAmount: 100 }],
    seller: { id: 3, name: "João" },
    contact: null,
    ...overrides,
  };
}

function paymentsBundle(overrides = {}) {
  return {
    payments: overrides.payments || [
      {
        id: 1,
        method: "pix",
        amount: 100,
        status: "paid",
        cardInstallmentCount: null,
      },
    ],
    summary: {
      totalAmount: 100,
      effectivePaid: 100,
      pendingAmount: 0,
      remainingToReceive: 0,
      remainingToAllocate: 0,
      paymentStatus: "paid",
      ...(overrides.summary || {}),
    },
  };
}

function renderWizard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SaleWizardPage />
    </ThemeProvider>
  );
}

async function goToPaymentStep() {
  renderWizard();
  await screen.findByTestId("sale-wizard-customer-step");
  userEvent.click(screen.getByTestId("sale-wizard-walk-in"));
  userEvent.click(screen.getByTestId("sale-wizard-next"));
  await screen.findByTestId("sale-wizard-products-step");
  userEvent.click(screen.getByTestId("sale-wizard-next"));
  await screen.findByTestId("sale-wizard-delivery-step");
  userEvent.click(screen.getByTestId("sale-wizard-next"));
  await waitFor(() => expect(mockUpdateDelivery).toHaveBeenCalled());
  await screen.findByTestId("sale-wizard-payment-step");
}

describe("SaleWizardPage", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockPerms.canManagePayments = true;
    mockPerms.canCreateSale = true;
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockGetPayments.mockReset();
    mockAddPayment.mockReset();
    mockUpdateDelivery.mockReset();
    mockComplete.mockReset();
    mockPush.mockClear();
    mockGet.mockResolvedValue({ data: draftSale() });
    mockUpdate.mockImplementation((_id, body) =>
      Promise.resolve({
        data: draftSale({
          ...body,
          id: 12,
          status: "draft",
          items: draftSale().items,
          seller: { id: 3, name: "João" },
        }),
      })
    );
    mockUpdateDelivery.mockResolvedValue({
      data: draftSale({
        deliveryMethodId: 1,
        deliveryMethodName: "Retirada na loja",
        deliveryKind: "pickup",
        freightAmount: 0,
      }),
    });
    mockGetPayments.mockResolvedValue({ data: paymentsBundle() });
    mockComplete.mockResolvedValue({
      data: draftSale({
        status: "completed",
        saleNumber: 128,
        paymentMethod: "pix",
        paymentStatus: "paid",
        paidAmount: 100,
        completedAt: "2026-10-07T12:00:00.000Z",
      }),
    });
  });

  it("carrega draft no refresh sem criar outro", async () => {
    renderWizard();
    expect(await screen.findByTestId("sale-wizard-page")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith("12");
    expect(screen.getByTestId("sale-wizard-seller-name").textContent).toMatch(/João/);
    expect(screen.getByTestId("sale-wizard-walk-in")).toBeTruthy();
  });

  it("venda com payments lines até sucesso com paymentMode lines", async () => {
    await goToPaymentStep();
    await waitFor(() => expect(mockGetPayments).toHaveBeenCalled());
    expect(screen.getByTestId("sale-wizard-payment-summary")).toBeTruthy();
    expect(screen.getByTestId("sale-wizard-payment-remaining").textContent).toMatch(
      /R\$\s*0,00/
    );

    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-review-step");
    expect(screen.getByTestId("sale-wizard-review-payment").textContent).toMatch(/PIX/i);

    userEvent.click(screen.getByTestId("sale-wizard-confirm"));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(mockComplete.mock.calls[0][1]).toEqual({
      sellerUserId: 3,
      paymentMode: "lines",
    });
    expect(await screen.findByTestId("sale-wizard-success")).toBeTruthy();
  });

  it("bloqueia Continuar se falta distribuir", async () => {
    mockGetPayments.mockResolvedValue({
      data: paymentsBundle({
        payments: [],
        summary: {
          totalAmount: 100,
          effectivePaid: 0,
          pendingAmount: 0,
          remainingToReceive: 100,
          remainingToAllocate: 100,
          paymentStatus: "unpaid",
        },
      }),
    });
    await goToPaymentStep();
    await waitFor(() => expect(mockGetPayments).toHaveBeenCalled());
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await waitFor(() =>
      expect(screen.getByTestId("sale-wizard-payment-step")).toBeTruthy()
    );
    expect(screen.queryByTestId("sale-wizard-review-step")).toBeNull();
  });

  it("empty state e botão adicionar", async () => {
    mockGetPayments.mockResolvedValue({
      data: paymentsBundle({
        payments: [],
        summary: {
          totalAmount: 100,
          effectivePaid: 0,
          pendingAmount: 0,
          remainingToReceive: 100,
          remainingToAllocate: 100,
          paymentStatus: "unpaid",
        },
      }),
    });
    await goToPaymentStep();
    expect(await screen.findByText(/Nenhuma forma de pagamento/i)).toBeTruthy();
    expect(screen.getByTestId("sale-wizard-payment-add")).toBeTruthy();
  });

  it("sem managePayments não edita pagamento e conclui sem paymentMode", async () => {
    mockPerms.canManagePayments = false;
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-step");
    expect(screen.getByText(/Pagamento não informado/i)).toBeTruthy();
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-review-step");
    userEvent.click(screen.getByTestId("sale-wizard-confirm"));
    await waitFor(() => expect(mockComplete).toHaveBeenCalled());
    expect(mockComplete.mock.calls[0][1]).toEqual({ sellerUserId: 3 });
    expect(mockGetPayments).not.toHaveBeenCalled();
  });

  it("double submit não duplica conclusão", async () => {
    let resolveComplete;
    mockComplete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveComplete = resolve;
        })
    );
    await goToPaymentStep();
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-confirm");
    const btn = screen.getByTestId("sale-wizard-confirm");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    resolveComplete({
      data: draftSale({
        status: "completed",
        saleNumber: 1,
        paymentStatus: "paid",
        paymentMethod: "pix",
      }),
    });
    await screen.findByTestId("sale-wizard-success");
  });
});
