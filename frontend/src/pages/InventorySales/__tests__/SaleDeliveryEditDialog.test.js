/**
 * @jest-environment jsdom
 */
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleDeliveryEditDialog from "../SaleDeliveryEditDialog";
import SaleDrawer from "../SaleDrawer";
import {
  getInventorySale,
  listInventoryDeliveryMethods,
  updateInventorySaleDelivery,
} from "../../../services/inventoryApi";

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("../SaleItemsEditor", () => () => (
  <div data-testid="sale-items-editor" />
));
jest.mock("../SalePaymentDialog", () => () => null);
jest.mock("../SalePaymentsSection", () => () => (
  <div data-testid="sale-payments-section" />
));
jest.mock("../SaleReceiptDialog", () => () => null);

const mockPerms = {
  canCreateSale: true,
  canManagePayments: true,
  canCancelSale: true,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySale: jest.fn(),
  updateInventorySale: jest.fn(),
  updateInventorySalePayment: jest.fn(),
  updateInventorySaleDelivery: jest.fn(),
  listInventoryDeliveryMethods: jest.fn(),
  completeInventorySale: jest.fn(),
  cancelInventorySale: jest.fn(),
  deleteInventorySale: jest.fn(),
  searchInventoryCustomers: jest.fn(),
  getInventorySalePayments: jest.fn(() =>
    Promise.resolve({ data: { payments: [], summary: null } })
  ),
}));

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

const theme = createTheme();

const methods = [
  {
    id: 1,
    name: "Retirada na loja",
    kind: "pickup",
    defaultAmount: 0,
    allowAmountOverride: false,
    requiresAddress: false,
    active: true,
  },
  {
    id: 11,
    name: "Motoboy",
    kind: "courier",
    defaultAmount: 20,
    allowAmountOverride: true,
    requiresAddress: true,
    active: true,
  },
  {
    id: 12,
    name: "Transportadora",
    kind: "carrier",
    defaultAmount: 30,
    allowAmountOverride: false,
    requiresAddress: true,
    active: true,
  },
];

function completedSale(overrides = {}) {
  return {
    id: 50,
    status: "completed",
    saleNumber: 50,
    deliveryMethodId: 11,
    deliveryMethodName: "Motoboy",
    deliveryKind: "courier",
    freightAmount: 20,
    subtotalAmount: 100,
    discountAmount: 0,
    totalAmount: 120,
    paidAmount: 100,
    paymentStatus: "partial",
    commissionAmount: 5,
    commissionRate: 5,
    contact: null,
    seller: { id: 1, name: "Vendedor" },
    delivery: {
      recipientName: "Ana",
      recipientPhone: "11999999999",
      postalCode: "",
      street: "Rua A",
      number: "10",
      complement: "",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      notes: "",
    },
    items: [],
    ...overrides,
  };
}

describe("SaleDeliveryEditDialog", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    mockPerms.canCreateSale = true;
    listInventoryDeliveryMethods.mockResolvedValue({ data: methods });
    updateInventorySaleDelivery.mockResolvedValue({
      data: completedSale({ freightAmount: 25, totalAmount: 125 }),
    });
  });

  it("preenche snapshot, preview de total e salva", async () => {
    const onSaved = jest.fn();
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          sale={completedSale()}
          onClose={jest.fn()}
          onSaved={onSaved}
        />
      </ThemeProvider>
    );

    await screen.findByTestId("sale-delivery-edit-dialog");
    await waitFor(() =>
      expect(listInventoryDeliveryMethods).toHaveBeenCalled()
    );

    expect(screen.getByTestId("sale-delivery-edit-preview").textContent).toMatch(
      /120/
    );
    expect(screen.getByTestId("sale-delivery-edit-new-total").textContent).toMatch(
      /120/
    );
    expect(screen.getByDisplayValue("Ana")).toBeTruthy();
    expect(screen.getByDisplayValue("Rua A")).toBeTruthy();
    expect(screen.getByDisplayValue(/20,00/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("sale-delivery-edit-submit"));
    await waitFor(() =>
      expect(updateInventorySaleDelivery).toHaveBeenCalledWith(
        50,
        expect.objectContaining({
          deliveryMethodId: 11,
          freightAmount: 20,
          recipient: expect.objectContaining({
            recipientName: "Ana",
            street: "Rua A",
          }),
        })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("fixed freight desabilita CurrencyInput", async () => {
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          sale={completedSale({
            deliveryMethodId: 12,
            deliveryMethodName: "Transportadora",
            freightAmount: 30,
            totalAmount: 130,
            delivery: {
              recipientName: "Ana",
              recipientPhone: "11999999999",
              street: "Rua A",
              number: "10",
              district: "Centro",
              city: "São Paulo",
              state: "SP",
            },
          })}
          onClose={jest.fn()}
        />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("sale-delivery-edit-freight")).toBeTruthy()
    );
    expect(screen.getByTestId("sale-delivery-edit-freight").disabled).toBe(true);
    expect(screen.getByTestId("sale-delivery-edit-new-total").textContent).toMatch(
      /130/
    );
  });

  it("pickup no preview zera frete no novo total", async () => {
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          sale={completedSale({
            deliveryMethodId: 1,
            deliveryMethodName: "Retirada na loja",
            deliveryKind: "pickup",
            freightAmount: 0,
            totalAmount: 100,
            delivery: null,
          })}
          onClose={jest.fn()}
        />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("sale-delivery-edit-new-total").textContent).toMatch(
        /100/
      )
    );
    expect(screen.queryByTestId("sale-delivery-edit-freight")).toBeNull();
    expect(screen.queryByTestId("sale-delivery-edit-street")).toBeNull();
  });

  it("erro do backend mantém modal e valores", async () => {
    updateInventorySaleDelivery.mockRejectedValueOnce({
      response: {
        data: {
          error: "ERR_INVENTORY_SALE_TOTAL_BELOW_PAID",
          message:
            "Não é possível reduzir o total da venda para menos do que o valor já recebido.",
        },
      },
    });
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          sale={completedSale({ paidAmount: 120, paymentStatus: "paid" })}
          onClose={jest.fn()}
        />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("Ana")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("sale-delivery-edit-submit"));
    await waitFor(() =>
      expect(updateInventorySaleDelivery).toHaveBeenCalled()
    );
    expect(screen.getByTestId("sale-delivery-edit-dialog")).toBeTruthy();
    expect(screen.getByDisplayValue("Ana")).toBeTruthy();
  });

  it("bloqueia double submit", async () => {
    let resolveSave;
    updateInventorySaleDelivery.mockReturnValue(
      new Promise((r) => {
        resolveSave = r;
      })
    );
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          sale={completedSale()}
          onClose={jest.fn()}
        />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("Ana")).toBeTruthy()
    );
    const submit = screen.getByTestId("sale-delivery-edit-submit");
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(updateInventorySaleDelivery).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave({ data: completedSale() });
    });
  });
});

describe("SaleDrawer botão editar entrega", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    mockPerms.canCreateSale = true;
  });

  it("mostra botão em completed e não em cancelled", async () => {
    getInventorySale.mockResolvedValue({ data: completedSale() });
    const view = render(
      <ThemeProvider theme={theme}>
        <SaleDrawer open saleId={50} onClose={jest.fn()} />
      </ThemeProvider>
    );
    await screen.findByTestId("sale-items-editor");
    expect(screen.getByTestId("sale-edit-delivery")).toBeTruthy();
    view.unmount();

    getInventorySale.mockResolvedValue({
      data: completedSale({ status: "cancelled", id: 51 }),
    });
    render(
      <ThemeProvider theme={theme}>
        <SaleDrawer open saleId={51} onClose={jest.fn()} />
      </ThemeProvider>
    );
    await screen.findByTestId("sale-items-editor");
    expect(screen.queryByTestId("sale-edit-delivery")).toBeNull();
  });

  it("sem canCreateSale não mostra botão", async () => {
    mockPerms.canCreateSale = false;
    getInventorySale.mockResolvedValue({ data: completedSale() });
    render(
      <ThemeProvider theme={theme}>
        <SaleDrawer open saleId={50} onClose={jest.fn()} />
      </ThemeProvider>
    );
    await screen.findByTestId("sale-items-editor");
    expect(screen.queryByTestId("sale-edit-delivery")).toBeNull();
  });
});
