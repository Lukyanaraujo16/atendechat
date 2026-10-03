import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductFormDialog from "../ProductFormDialog";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockGet = jest.fn();

jest.mock("../../../services/inventoryApi", () => {
  const actual = jest.requireActual("../../../services/inventoryApi");
  return {
    ...actual,
    createInventoryProduct: (...args) => mockCreate(...args),
    updateInventoryProduct: (...args) => mockUpdate(...args),
    getInventoryProduct: (...args) => mockGet(...args),
  };
});

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function submitForm() {
  fireEvent.submit(document.querySelector("form"));
}

function renderDialog(props) {
  return render(
    <ProductFormDialog
      open
      onClose={jest.fn()}
      categories={[{ id: 3, name: "Geral" }]}
      onSaved={jest.fn()}
      {...props}
    />
  );
}

describe("formulário de produto — unidade de medida", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockGet.mockReset();
    mockCreate.mockResolvedValue({ data: { id: 1 } });
    mockUpdate.mockResolvedValue({ data: { id: 1 } });
  });

  it("explica a unidade e envia un na criação", async () => {
    renderDialog();
    expect(screen.getAllByText("Unidade de medida").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Como o produto é contado. Ex.: un, kg, L, m, cx.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Quantidade disponível no estoque ao cadastrar. Ex.: 50."
      )
    ).toBeTruthy();
    expect(screen.getByText(/estoque baixo/)).toBeTruthy();
    expect(screen.queryByLabelText("Quantidade inicial")).toBeTruthy();

    userEvent.click(screen.getByLabelText("Unidade de medida"));
    expect(await screen.findByText("kg — Quilograma")).toBeTruthy();
    expect(screen.getByText("Outro")).toBeTruthy();
    const unitOptions = screen.getAllByText("un — Unidade");
    userEvent.click(unitOptions[unitOptions.length - 1]);

    userEvent.type(screen.getByLabelText("Nome *"), "Caneta");
    userEvent.type(screen.getByLabelText("Preço de venda *"), "10");
    submitForm();

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Caneta",
          unit: "un",
          salePrice: 10,
        })
      );
    });
  });

  it("Outro envia a abreviação e recusa 50 e un50", async () => {
    renderDialog();
    userEvent.click(screen.getByLabelText("Unidade de medida"));
    userEvent.click(await screen.findByText("Outro"));
    const custom = screen.getByLabelText("Unidade personalizada");
    expect(
      screen.getByText("Informe uma abreviação curta. Ex.: par, rolo, kit.")
    ).toBeTruthy();

    userEvent.type(custom, "par");
    userEvent.type(screen.getByLabelText("Nome *"), "Meia");
    userEvent.type(screen.getByLabelText("Preço de venda *"), "12");
    submitForm();
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ unit: "par" })
      );
    });

    userEvent.clear(custom);
    userEvent.type(custom, "50");
    expect(
      screen.getByText(/não pode ser apenas um número/)
    ).toBeTruthy();
    mockCreate.mockClear();
    submitForm();
    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
    });

    userEvent.clear(custom);
    userEvent.type(custom, "un50");
    expect(screen.getByText(/misturar unidade de medida e quantidade/)).toBeTruthy();
  });

  it("edição preserva un50 e aceita correção para un", async () => {
    mockGet.mockResolvedValue({
      data: {
        name: "Legado",
        salePrice: 8,
        unit: "un50",
        trackStock: true,
        minStock: 10,
        active: true,
      },
    });
    renderDialog({ productId: 9 });
    const custom = await screen.findByLabelText("Unidade personalizada");
    expect(custom.value).toBe("un50");
    expect(screen.getByText(/pode corrigi-la ou manter/)).toBeTruthy();
    expect(screen.queryByLabelText("Quantidade inicial")).toBeNull();

    submitForm();
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ unit: "un50", name: "Legado" })
      );
    });
    expect(mockUpdate.mock.calls[0][1].currentQuantity).toBeUndefined();

    userEvent.click(screen.getByLabelText("Unidade de medida"));
    userEvent.click(await screen.findByText("un — Unidade"));
    submitForm();
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenLastCalledWith(
        9,
        expect.objectContaining({ unit: "un" })
      );
    });
  });

  it("oculta quantidade inicial e mínimo quando não controla estoque", () => {
    renderDialog();
    userEvent.click(screen.getByLabelText("Controlar estoque"));
    expect(screen.queryByLabelText("Quantidade inicial")).toBeNull();
    expect(screen.queryByLabelText("Estoque mínimo")).toBeNull();
  });
});
