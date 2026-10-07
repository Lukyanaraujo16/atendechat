/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryDeliveryMethodsSection from "../InventoryDeliveryMethodsSection";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDeactivate = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryDeliveryMethods: (...a) => mockList(...a),
  createInventoryDeliveryMethod: (...a) => mockCreate(...a),
  updateInventoryDeliveryMethod: (...a) => mockUpdate(...a),
  deactivateInventoryDeliveryMethod: (...a) => mockDeactivate(...a),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("InventoryDeliveryMethodsSection", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockList.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDeactivate.mockReset();
    mockList.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Retirada na loja",
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: false,
          active: true,
          position: 0,
        },
        {
          id: 2,
          name: "Motoboy",
          kind: "courier",
          defaultAmount: 15,
          allowAmountOverride: false,
          requiresAddress: true,
          active: true,
          position: 1,
        },
      ],
    });
  });

  it("lista e desativa modalidade", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryDeliveryMethodsSection />
      </ThemeProvider>
    );
    expect(await screen.findByText("Motoboy")).toBeTruthy();
    expect(mockList).toHaveBeenCalled();
    mockDeactivate.mockResolvedValue({ data: { id: 2, active: false } });
    fireEvent.click(screen.getByTestId("delivery-method-toggle-2"));
    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledWith(2));
  });

  it("cria modalidade e pickup trava valor/endereço no formulário", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryDeliveryMethodsSection />
      </ThemeProvider>
    );
    await screen.findByTestId("delivery-method-create");
    fireEvent.click(screen.getByTestId("delivery-method-create"));
    fireEvent.change(screen.getByTestId("delivery-method-name"), {
      target: { value: "Expresso" },
    });
    mockCreate.mockResolvedValue({ data: { id: 3 } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar|Salvar/i }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].name).toBe("Expresso");
  });

  it("pickup trava valor/endereço no formulário", async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryDeliveryMethodsSection />
      </ThemeProvider>
    );
    await screen.findByTestId("delivery-method-create");
    fireEvent.click(screen.getByTestId("delivery-method-create"));
    fireEvent.mouseDown(screen.getByLabelText(/Tipo/i));
    const pickupOption = await screen.findByRole("option", { name: /^Retirada$/ });
    fireEvent.click(pickupOption);
    expect(screen.getByText(/Retirada: taxa R\$ 0,00/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Valor padrão/i)).toBeNull();
  });

  it("reativa modalidade via PUT active=true", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: 2,
          name: "Motoboy",
          kind: "courier",
          defaultAmount: 15,
          allowAmountOverride: false,
          requiresAddress: true,
          active: false,
          position: 1,
        },
      ],
    });
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryDeliveryMethodsSection />
      </ThemeProvider>
    );
    await screen.findByTestId("delivery-method-toggle-2");
    mockUpdate.mockResolvedValue({ data: { id: 2, active: true } });
    fireEvent.click(screen.getByTestId("delivery-method-toggle-2"));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(2, { active: true })
    );
  });
});
