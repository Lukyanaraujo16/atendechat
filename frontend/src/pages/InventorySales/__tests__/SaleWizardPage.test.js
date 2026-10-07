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
const mockUpdatePayment = jest.fn();
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
  updateInventorySalePayment: (...a) => mockUpdatePayment(...a),
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

function renderWizard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SaleWizardPage />
    </ThemeProvider>
  );
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
    mockUpdatePayment.mockReset();
    mockUpdateDelivery.mockReset();
    mockComplete.mockReset();
    mockPush.mockClear();
    mockGet.mockResolvedValue({ data: draftSale() });
    mockUpdate.mockImplementation((_id, body) =>
      Promise.resolve({ data: draftSale({ ...body, id: 12, status: "draft", items: draftSale().items, seller: { id: 3, name: "João" } }) })
    );
    mockUpdateDelivery.mockResolvedValue({
      data: draftSale({
        deliveryMethodId: 1,
        deliveryMethodName: "Retirada na loja",
        deliveryKind: "pickup",
        freightAmount: 0,
      }),
    });
    mockUpdatePayment.mockImplementation((_id, body) =>
      Promise.resolve({
        data: draftSale({
          paymentMethod: body.paymentMethod,
          cardInstallmentCount: body.cardInstallmentCount,
          paymentNotes: body.paymentNotes,
          deliveryMethodId: 1,
          deliveryMethodName: "Retirada na loja",
          deliveryKind: "pickup",
          freightAmount: 0,
        }),
      })
    );
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

  it("venda sem cliente + PIX pago até sucesso", async () => {
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-walk-in"));
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1].contactId).toBeNull();
    expect(mockUpdate.mock.calls[0][1].sellerUserId).toBe(3);

    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    expect(screen.getByTestId("sale-wizard-step-delivery")).toBeTruthy();
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await waitFor(() => expect(mockUpdateDelivery).toHaveBeenCalled());
    await screen.findByTestId("sale-wizard-payment-step");
    userEvent.click(screen.getByTestId("sale-wizard-pay-pix"));
    expect(screen.getByTestId("sale-wizard-register-as-paid").checked).toBe(true);
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await waitFor(() => expect(mockUpdatePayment).toHaveBeenCalled());
    expect(mockUpdatePayment.mock.calls[0][1].paymentMethod).toBe("pix");

    await screen.findByTestId("sale-wizard-review-step");
    expect(screen.getByTestId("sale-wizard-review-paid-status").textContent).toMatch(
      /pago/i
    );
    userEvent.click(screen.getByTestId("sale-wizard-confirm"));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(mockComplete.mock.calls[0][1]).toEqual({
      sellerUserId: 3,
      registerAsPaid: true,
    });
    expect(await screen.findByTestId("sale-wizard-success")).toBeTruthy();
  });

  it("cartão exige pago e parcelas 1..18", async () => {
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-walk-in"));
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-step");
    userEvent.click(screen.getByTestId("sale-wizard-pay-credit_card"));
    const paidBox = screen.getByTestId("sale-wizard-register-as-paid");
    expect(paidBox.disabled).toBe(true);
    expect(paidBox.checked).toBe(true);
    expect(screen.getByTestId("sale-wizard-card-installments")).toBeTruthy();
  });

  it("boleto default pendente", async () => {
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-step");
    userEvent.click(screen.getByTestId("sale-wizard-pay-boleto"));
    expect(screen.getByTestId("sale-wizard-register-as-paid").checked).toBe(false);
  });

  it("sem managePayments não edita pagamento e conclui sem registerAsPaid", async () => {
    mockPerms.canManagePayments = false;
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-readonly");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-review-step");
    userEvent.click(screen.getByTestId("sale-wizard-confirm"));
    await waitFor(() => expect(mockComplete).toHaveBeenCalled());
    expect(mockComplete.mock.calls[0][1]).toEqual({ sellerUserId: 3 });
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });

  it("erro ao salvar pagamento impede complete", async () => {
    mockUpdatePayment.mockRejectedValueOnce(new Error("fail"));
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-step");
    userEvent.click(screen.getByTestId("sale-wizard-pay-cash"));
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await waitFor(() => expect(mockUpdatePayment).toHaveBeenCalled());
    expect(mockComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("sale-wizard-payment-step")).toBeTruthy();
  });

  it("double submit não duplica conclusão", async () => {
    let resolveComplete;
    mockComplete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveComplete = resolve;
        })
    );
    renderWizard();
    await screen.findByTestId("sale-wizard-customer-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-products-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-delivery-step");
    userEvent.click(screen.getByTestId("sale-wizard-next"));
    await screen.findByTestId("sale-wizard-payment-step");
    userEvent.click(screen.getByTestId("sale-wizard-pay-pix"));
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
