/**
 * @jest-environment jsdom
 */
import React, { createRef } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleWizardDeliveryStep from "../wizard/SaleWizardDeliveryStep";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockList = jest.fn();
const mockUpdateDelivery = jest.fn();
const mockToastError = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryDeliveryMethods: (...a) => mockList(...a),
  updateInventorySaleDelivery: (...a) => mockUpdateDelivery(...a),
}));

jest.mock("../../../errors/toastError", () => (...a) => mockToastError(...a));

const pickup = {
  id: 1,
  name: "Retirada na loja",
  kind: "pickup",
  defaultAmount: 0,
  allowAmountOverride: false,
  requiresAddress: false,
  active: true,
};

const motoboy = {
  id: 2,
  name: "Motoboy",
  kind: "courier",
  defaultAmount: 15,
  allowAmountOverride: false,
  requiresAddress: true,
  active: true,
};

const carrier = {
  id: 3,
  name: "Transportadora",
  kind: "carrier",
  defaultAmount: 0,
  allowAmountOverride: true,
  requiresAddress: true,
  active: true,
};

const contactComplete = {
  id: 9,
  name: "Cliente",
  number: "11988887777",
  street: "Rua Cliente",
  addressNumber: "100",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
};

function saleBase(overrides = {}) {
  return {
    id: 55,
    status: "draft",
    subtotalAmount: 100,
    discountAmount: 0,
    totalAmount: 100,
    freightAmount: 0,
    items: [{ id: 1 }],
    contact: null,
    ...overrides,
  };
}

function renderStep(props = {}) {
  const ref = createRef();
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <SaleWizardDeliveryStep
        ref={ref}
        sale={saleBase()}
        contact={null}
        itemCount={1}
        disabled={false}
        {...props}
      />
    </ThemeProvider>
  );
  return { ...utils, ref };
}

describe("SaleWizardDeliveryStep", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockList.mockReset();
    mockUpdateDelivery.mockReset();
    mockList.mockResolvedValue({ data: [pickup, motoboy, carrier] });
    mockUpdateDelivery.mockResolvedValue({
      data: saleBase({
        deliveryMethodId: 1,
        deliveryMethodName: "Retirada na loja",
        deliveryKind: "pickup",
        freightAmount: 0,
        totalAmount: 100,
      }),
    });
  });

  it("lista modalidades e pickup não mostra endereço nem frete editável", async () => {
    renderStep();
    await screen.findByTestId("sale-wizard-delivery-step");
    expect(mockList).toHaveBeenCalledWith({ active: true });
    fireEvent.click(screen.getByTestId("delivery-method-card-1"));
    expect(screen.getByTestId("delivery-pickup-info")).toBeTruthy();
    expect(screen.queryByTestId("delivery-address-section")).toBeNull();
    expect(screen.queryByTestId("delivery-override-fee")).toBeNull();
    expect(screen.queryByTestId("delivery-fixed-fee")).toBeNull();
  });

  it("taxa fixa sem edição; override mostra CurrencyInput", async () => {
    renderStep({ contact: contactComplete });
    await screen.findByTestId("sale-wizard-delivery-step");
    fireEvent.click(screen.getByTestId("delivery-method-card-2"));
    expect(screen.getByTestId("delivery-fixed-fee").textContent).toMatch(/15/);
    expect(screen.queryByTestId("delivery-override-fee")).toBeNull();
    expect(screen.getByTestId("delivery-address-section")).toBeTruthy();
    expect(screen.getByTestId("delivery-contact-address")).toBeTruthy();

    fireEvent.click(screen.getByTestId("delivery-method-card-3"));
    expect(screen.getByTestId("delivery-override-fee")).toBeTruthy();
  });

  it("walk-in mostra formulário; obrigatórios bloqueiam PUT; PUT no persist", async () => {
    const { ref } = renderStep({ contact: null });
    await screen.findByTestId("sale-wizard-delivery-step");
    fireEvent.click(screen.getByTestId("delivery-method-card-2"));
    expect(screen.getByTestId("delivery-address-form")).toBeTruthy();
    expect(screen.queryByTestId("delivery-contact-address")).toBeNull();

    const blocked = await ref.current.persist();
    expect(blocked).toBeNull();
    expect(mockUpdateDelivery).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("delivery-field-recipientName"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByTestId("delivery-field-recipientPhone"), {
      target: { value: "11999999999" },
    });
    fireEvent.change(screen.getByTestId("delivery-field-street"), {
      target: { value: "Rua A" },
    });
    fireEvent.change(screen.getByTestId("delivery-field-number"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("delivery-field-district"), {
      target: { value: "Centro" },
    });
    fireEvent.change(screen.getByTestId("delivery-field-city"), {
      target: { value: "São Paulo" },
    });
    fireEvent.mouseDown(screen.getByLabelText(/UF/i));
    const sps = await screen.findAllByText("SP");
    fireEvent.click(sps[sps.length - 1]);

    mockUpdateDelivery.mockResolvedValue({
      data: saleBase({
        deliveryMethodId: 2,
        deliveryMethodName: "Motoboy",
        deliveryKind: "courier",
        freightAmount: 15,
        totalAmount: 115,
      }),
    });
    const ok = await ref.current.persist();
    expect(mockUpdateDelivery).toHaveBeenCalled();
    expect(mockUpdateDelivery.mock.calls[0][1].deliveryMethodId).toBe(2);
    expect(mockUpdateDelivery.mock.calls[0][1].recipient.street).toBe("Rua A");
    expect(ok.freightAmount).toBe(15);
  });

  it("outro endereço não chama API de Contact; snapshot tem prioridade", async () => {
    const sale = saleBase({
      deliveryMethodId: 2,
      deliveryMethodName: "Motoboy",
      freightAmount: 15,
      totalAmount: 115,
      delivery: {
        recipientName: "Outro",
        recipientPhone: "11000000000",
        street: "Rua Snapshot",
        number: "9",
        district: "Bairro",
        city: "Campinas",
        state: "SP",
      },
    });
    renderStep({ sale, contact: contactComplete });
    await screen.findByTestId("sale-wizard-delivery-step");
    expect(screen.getByDisplayValue("Rua Snapshot")).toBeTruthy();
    expect(screen.queryByDisplayValue("Rua Cliente")).toBeNull();
    // Nenhuma chamada a /contacts
    expect(mockUpdateDelivery).not.toHaveBeenCalled();
  });

  it("pickup no Continuar envia só method e zera frete no backend mock", async () => {
    const { ref } = renderStep();
    await screen.findByTestId("sale-wizard-delivery-step");
    fireEvent.click(screen.getByTestId("delivery-method-card-1"));
    await ref.current.persist();
    await waitFor(() => expect(mockUpdateDelivery).toHaveBeenCalled());
    expect(mockUpdateDelivery.mock.calls[0][1]).toEqual({
      deliveryMethodId: 1,
    });
  });
});
