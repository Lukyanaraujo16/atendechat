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
const mockSaveVariable = jest.fn();

jest.mock("../../../services/inventoryApi", () => {
  const actual = jest.requireActual("../../../services/inventoryApi");
  return {
    ...actual,
    createInventoryProduct: (...args) => mockCreate(...args),
    updateInventoryProduct: (...args) => mockUpdate(...args),
    getInventoryProduct: (...args) => mockGet(...args),
    saveInventoryVariableProduct: (...args) => mockSaveVariable(...args),
  };
});

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@material-ui/core/useMediaQuery", () => () => false);

function typeCents(input, digits) {
  for (const d of String(digits)) {
    fireEvent.keyDown(input, { key: d });
  }
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

describe("ProductFormDialog — produto com variações", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockGet.mockReset();
    mockSaveVariable.mockReset();
    mockSaveVariable.mockResolvedValue({ data: { product: { id: 9 } } });
  });

  it("exibe experiência de características e não exige salvar antes", () => {
    renderDialog();
    userEvent.click(screen.getByLabelText("Produto com variações"));
    expect(screen.getByText("Como este produto varia?")).toBeTruthy();
    expect(screen.queryByText(/Salve o produto e edite-o/i)).toBeNull();
    expect(screen.getByPlaceholderText("Ex.: Cor")).toBeTruthy();
  });

  it("cadastra três cores com máscara BRL em um único salvamento", async () => {
    renderDialog();
    userEvent.click(screen.getByLabelText("Produto com variações"));
    userEvent.type(screen.getByLabelText("Nome *"), "iPhone 17 Pro Max");

    const charInput = screen.getByPlaceholderText("Ex.: Cor");
    userEvent.type(charInput, "Cor");
    fireEvent.blur(charInput);

    userEvent.type(screen.getByPlaceholderText("Ex.: Azul"), "Azul");
    userEvent.click(screen.getByRole("button", { name: "Adicionar opção" }));
    userEvent.type(screen.getByPlaceholderText("Ex.: Azul"), "Branco");
    userEvent.click(screen.getByRole("button", { name: "Adicionar opção" }));
    userEvent.type(screen.getByPlaceholderText("Ex.: Azul"), "Rosé");
    userEvent.click(screen.getByRole("button", { name: "Adicionar opção" }));

    await waitFor(() => {
      expect(screen.getByText("Preços e estoque por variação")).toBeTruthy();
    });

    const saleInputs = screen.getAllByTestId(/^variant-sale-/);
    expect(saleInputs).toHaveLength(3);
    // 850000 cents → R$ 8.500,00
    typeCents(saleInputs[0], "850000");
    typeCents(saleInputs[1], "870000");
    typeCents(saleInputs[2], "890000");

    expect(saleInputs[0].value).toMatch(/8\.500,00/);

    fireEvent.submit(document.querySelector("form"));

    await waitFor(() => {
      expect(mockSaveVariable).toHaveBeenCalled();
    });
    expect(mockCreate).not.toHaveBeenCalled();
    const [body, productId] = mockSaveVariable.mock.calls[0];
    expect(productId).toBeNull();
    expect(body.characteristics).toEqual([
      { name: "Cor", options: ["Azul", "Branco", "Rosé"] },
    ]);
    expect(body.variants).toHaveLength(3);
    expect(body.variants.map((v) => v.salePrice)).toEqual([8500, 8700, 8900]);
    expect(body.variants.every((v) => typeof v.salePrice === "number")).toBe(
      true
    );
  });

  it("produto simples continua usando createInventoryProduct", async () => {
    mockCreate.mockResolvedValue({ data: { id: 1 } });
    renderDialog();
    userEvent.type(screen.getByLabelText("Nome *"), "Caneta");
    userEvent.type(screen.getByLabelText("Preço de venda *"), "10");
    fireEvent.submit(document.querySelector("form"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockSaveVariable).not.toHaveBeenCalled();
  });
});
