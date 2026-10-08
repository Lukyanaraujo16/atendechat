/**
 * @jest-environment jsdom
 */
import React, { createRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import axios from "axios";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardDeliveryStep from "../wizard/SaleWizardDeliveryStep";
import SaleDeliveryEditDialog from "../SaleDeliveryEditDialog";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isCancel: () => false,
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryDeliveryMethods: jest.fn(),
  updateInventorySaleDelivery: jest.fn(),
}));

const {
  listInventoryDeliveryMethods,
  updateInventorySaleDelivery,
} = require("../../../services/inventoryApi");

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
    defaultAmount: 15,
    allowAmountOverride: true,
    requiresAddress: true,
    active: true,
  },
];

const saleBase = {
  id: 70,
  status: "draft",
  deliveryMethodId: 11,
  deliveryMethodName: "Motoboy",
  deliveryKind: "courier",
  freightAmount: 15,
  subtotalAmount: 100,
  discountAmount: 0,
  totalAmount: 115,
  delivery: null,
};

describe("Delivery ViaCEP", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    jest.useFakeTimers();
    listInventoryDeliveryMethods.mockResolvedValue({ data: methods });
    updateInventorySaleDelivery.mockResolvedValue({ data: saleBase });
    axios.get.mockResolvedValue({
      data: {
        cep: "29100-000",
        logradouro: "Rua Exemplo",
        bairro: "Centro",
        localidade: "Vila Velha",
        uf: "ES",
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("wizard: prefill do Contact não dispara lookup; alterar CEP dispara", async () => {
    const contact = {
      id: 3,
      name: "Cliente",
      number: "5527999999999",
      postalCode: "29000-000",
      street: "Rua do Contato",
      addressNumber: "50",
      addressComplement: "",
      district: "Praia",
      city: "Vitória",
      state: "ES",
    };
    render(
      <ThemeProvider theme={theme}>
        <SaleWizardDeliveryStep
          ref={createRef()}
          sale={{
            ...saleBase,
            delivery: {
              recipientName: "Cliente",
              recipientPhone: "5527999999999",
              postalCode: "29000-000",
              street: "Rua do Contato",
              number: "50",
              complement: "",
              district: "Praia",
              city: "Vitória",
              state: "ES",
            },
          }}
          contact={contact}
          itemCount={1}
        />
      </ThemeProvider>
    );

    await screen.findByTestId("sale-wizard-delivery-step");
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(axios.get).not.toHaveBeenCalled();

    // outro endereço para editar CEP
    const other = screen.queryByTestId("delivery-other-address");
    if (other) fireEvent.click(other);

    const cep = await screen.findByTestId("delivery-field-postalCode");
    fireEvent.change(cep, { target: { value: "29100-000" } });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() =>
      expect(screen.getByTestId("delivery-field-street").value).toBe(
        "Rua Exemplo"
      )
    );
  });

  it("wizard sem cliente: CEP autofill; pickup sem lookup", async () => {
    render(
      <ThemeProvider theme={theme}>
        <SaleWizardDeliveryStep
          ref={createRef()}
          sale={saleBase}
          contact={null}
          itemCount={1}
        />
      </ThemeProvider>
    );
    await screen.findByTestId("delivery-address-form");
    fireEvent.change(screen.getByTestId("delivery-field-postalCode"), {
      target: { value: "29100000" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() =>
      expect(screen.getByTestId("delivery-field-city").value).toBe("Vila Velha")
    );

    // troca para pickup
    fireEvent.click(screen.getByText("Retirada na loja"));
    axios.get.mockClear();
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("delivery-field-postalCode")).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("E3: abrir não consulta; alterar CEP consulta", async () => {
    render(
      <ThemeProvider theme={theme}>
        <SaleDeliveryEditDialog
          open
          onClose={jest.fn()}
          sale={{
            ...saleBase,
            status: "completed",
            paidAmount: 100,
            paymentStatus: "partial",
            delivery: {
              recipientName: "Ana",
              recipientPhone: "11999999999",
              postalCode: "29000-000",
              street: "Rua Velha",
              number: "10",
              complement: "Fundos",
              district: "Centro",
              city: "Vitória",
              state: "ES",
            },
          }}
        />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("sale-delivery-edit-street").value).toBe(
        "Rua Velha"
      )
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(axios.get).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("sale-delivery-edit-postalCode"), {
      target: { value: "29100-000" },
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() =>
      expect(screen.getByTestId("sale-delivery-edit-street").value).toBe(
        "Rua Exemplo"
      )
    );
    expect(screen.getByTestId("sale-delivery-edit-number").value).toBe("10");
    expect(screen.getByTestId("sale-delivery-edit-complement").value).toBe(
      "Fundos"
    );
  });
});
