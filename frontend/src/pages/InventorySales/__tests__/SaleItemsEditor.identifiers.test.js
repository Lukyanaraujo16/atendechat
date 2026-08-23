/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import { changeLanguage, i18n } from "../../../translate/i18n";
import SaleItemsEditor from "../SaleItemsEditor";
import {
  addInventorySaleItem,
  updateInventorySaleItem,
} from "../../../services/inventoryApi";
import useIsMobile from "../../../hooks/useIsMobile";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.mock("../../../services/inventoryApi", () => ({
  addInventorySaleItem: jest.fn(),
  updateInventorySaleItem: jest.fn(),
  deleteInventorySaleItem: jest.fn(),
}));

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

const theme = createTheme();

function itemBase(overrides = {}) {
  return {
    id: 21,
    productName: "Roteador XYZ",
    productSku: "RT-1",
    quantity: 1,
    unitPrice: "100",
    discountAmount: "0",
    totalAmount: "100",
    identifiers: [],
    ...overrides,
  };
}

function saleBase(overrides = {}) {
  return {
    id: 7,
    status: "draft",
    items: [itemBase()],
    subtotalAmount: "100",
    discountAmount: "0",
    totalAmount: "100",
    ...overrides,
  };
}

function renderEditor(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SaleItemsEditor
        sale={saleBase()}
        products={[{ id: 10, name: "Roteador XYZ", sku: "RT-1", salePrice: 100, active: true }]}
        readOnly={false}
        onSaleUpdated={jest.fn()}
        {...props}
      />
    </ThemeProvider>
  );
}

describe("SaleItemsEditor identifiers", () => {
  beforeEach(() => {
    changeLanguage("pt");
    useIsMobile.mockReturnValue(false);
    jest.clearAllMocks();
    addInventorySaleItem.mockResolvedValue({});
    updateInventorySaleItem.mockResolvedValue({});
  });

  it("14. carrega draft existente nos campos corretos", () => {
    const { getByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            quantity: 2,
            identifiers: [
              { id: 1, position: 1, identifier: "SN-A123" },
              { id: 2, position: 2, identifier: "SN-A124" },
            ],
          }),
        ],
      }),
    });
    expect(getByTestId("sale-item-identifier-input-21-1").value).toBe("SN-A123");
    expect(getByTestId("sale-item-identifier-input-21-2").value).toBe("SN-A124");
  });

  it("15. venda antiga identifiers [] não quebra e não mostra lista vazia", () => {
    const { getByText, queryByTestId } = renderEditor({
      sale: saleBase({
        status: "completed",
        items: [itemBase({ identifiers: [] })],
      }),
      readOnly: true,
    });
    expect(getByText("Roteador XYZ")).toBeTruthy();
    expect(queryByTestId("sale-item-identifiers-readonly-21")).toBeNull();
  });

  it("16. completed é somente leitura textual", () => {
    const { getByTestId, queryByTestId } = renderEditor({
      sale: saleBase({
        status: "completed",
        items: [
          itemBase({
            quantity: 2,
            identifiers: [
              { position: 1, identifier: "SN-A123" },
              { position: 2, identifier: "SN-A124" },
            ],
          }),
        ],
      }),
      readOnly: true,
    });
    expect(getByTestId("sale-item-identifiers-readonly-21").textContent).toContain(
      "1. SN-A123"
    );
    expect(queryByTestId("sale-item-identifier-input-21-1")).toBeNull();
  });

  it("17. cancelled é somente leitura textual", () => {
    const { getByTestId, queryByTestId } = renderEditor({
      sale: saleBase({
        status: "cancelled",
        items: [
          itemBase({
            identifiers: [{ position: 1, identifier: "SN-A123" }],
          }),
        ],
      }),
      readOnly: true,
    });
    expect(getByTestId("sale-item-identifiers-readonly-21").textContent).toContain(
      "1. SN-A123"
    );
    expect(queryByTestId("sale-item-identifier-input-21-1")).toBeNull();
  });

  it("18. drawer/detalhe mostra identifiers por item", () => {
    const { getByTestId } = renderEditor({
      sale: saleBase({
        status: "completed",
        items: [
          itemBase({
            quantity: 2,
            identifiers: [
              { position: 1, identifier: "SN-A123" },
              { position: 2, identifier: "SN-A124" },
            ],
          }),
        ],
      }),
      readOnly: true,
    });
    const block = getByTestId("sale-item-identifiers-readonly-21");
    expect(block.textContent).toContain("Identificações");
    expect(block.textContent).toContain("1. SN-A123");
    expect(block.textContent).toContain("2. SN-A124");
  });

  it("6. redução com identifier excedente bloqueia o save", async () => {
    const { getByDisplayValue, getByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            quantity: 3,
            identifiers: [
              { position: 1, identifier: "A" },
              { position: 3, identifier: "C" },
            ],
          }),
        ],
      }),
    });
    fireEvent.change(getByDisplayValue("3"), { target: { value: "2" } });
    fireEvent.click(getByTestId("sale-item-save-21"));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t("inventorySales.sales.items.identifiers.reduceQuantity", {
        position: 3,
      })
    );
    expect(updateInventorySaleItem).not.toHaveBeenCalled();
  });

  it("13. duplicado no mesmo item bloqueia o submit", async () => {
    const { getByTestId } = renderEditor({
      sale: saleBase({
        items: [itemBase({ quantity: 2, identifiers: [] })],
      }),
    });
    fireEvent.click(getByTestId("sale-item-identifiers-toggle-21"));
    await waitFor(() => getByTestId("sale-item-identifier-input-21-1"));
    fireEvent.change(getByTestId("sale-item-identifier-input-21-1"), {
      target: { value: "SN-DUP" },
    });
    fireEvent.change(getByTestId("sale-item-identifier-input-21-2"), {
      target: { value: "SN-DUP" },
    });
    fireEvent.click(getByTestId("sale-item-save-21"));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t("inventorySales.sales.items.identifiers.duplicate")
    );
    expect(updateInventorySaleItem).not.toHaveBeenCalled();
  });

  it("22. payload create envia identifiers preenchidos e omite vazios", async () => {
    const { getByTestId, getByLabelText, getByText } = renderEditor({
      sale: saleBase({ items: [] }),
    });
    fireEvent.mouseDown(getByLabelText("Produto"));
    fireEvent.click(getByText(/Roteador XYZ/));
    fireEvent.click(getByTestId("sale-item-identifiers-toggle-add"));
    await waitFor(() => getByTestId("sale-item-identifier-input-add-1"));
    fireEvent.change(getByTestId("sale-item-identifier-input-add-1"), {
      target: { value: "  SN123  " },
    });
    fireEvent.click(getByText("Adicionar item"));
    await waitFor(() => expect(addInventorySaleItem).toHaveBeenCalled());
    expect(addInventorySaleItem).toHaveBeenCalledWith(7, {
      productId: 10,
      quantity: 1,
      identifiers: [{ position: 1, identifier: "SN123" }],
    });
  });

  it("22b. payload create sem identifier omite o campo", async () => {
    const { getByLabelText, getByText } = renderEditor({
      sale: saleBase({ items: [] }),
    });
    fireEvent.mouseDown(getByLabelText("Produto"));
    fireEvent.click(getByText(/Roteador XYZ/));
    fireEvent.click(getByText("Adicionar item"));
    await waitFor(() => expect(addInventorySaleItem).toHaveBeenCalled());
    const payload = addInventorySaleItem.mock.calls[0][1];
    expect(payload.productId).toBe(10);
    expect(payload.quantity).toBe(1);
    expect(payload).not.toHaveProperty("identifiers");
  });

  it("23. update de preço não envia identifiers", async () => {
    const { getByDisplayValue, getByTestId } = renderEditor();
    fireEvent.change(getByDisplayValue("100"), { target: { value: "120" } });
    fireEvent.click(getByTestId("sale-item-save-21"));
    await waitFor(() => expect(updateInventorySaleItem).toHaveBeenCalled());
    expect(updateInventorySaleItem).toHaveBeenCalledWith(7, 21, {
      quantity: 1,
      unitPrice: 120,
      discountAmount: 0,
    });
    expect(updateInventorySaleItem.mock.calls[0][2]).not.toHaveProperty(
      "identifiers"
    );
  });

  it("24. remover todos os identifiers envia lista vazia", async () => {
    const { getByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            identifiers: [{ id: 1, position: 1, identifier: "SN-A123" }],
          }),
        ],
      }),
    });
    fireEvent.change(getByTestId("sale-item-identifier-input-21-1"), {
      target: { value: "" },
    });
    fireEvent.click(getByTestId("sale-item-save-21"));
    await waitFor(() => expect(updateInventorySaleItem).toHaveBeenCalled());
    expect(updateInventorySaleItem).toHaveBeenCalledWith(7, 21, {
      quantity: 1,
      unitPrice: 100,
      discountAmount: 0,
      identifiers: [],
    });
  });

  it("integer → fractional A) save bloqueado enquanto identifiers existem", async () => {
    const { getByDisplayValue, getByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            quantity: 2,
            identifiers: [
              { position: 1, identifier: "SN-A" },
              { position: 2, identifier: "SN-B" },
            ],
          }),
        ],
      }),
    });
    fireEvent.change(getByDisplayValue("2"), { target: { value: "1.5" } });
    expect(
      getByTestId("sale-item-identifiers-fractional-resolve-21").textContent
    ).toContain("quantidade fracionária");
    expect(getByTestId("sale-item-identifier-input-21-1").value).toBe("SN-A");
    expect(getByTestId("sale-item-identifier-input-21-2").value).toBe("SN-B");
    fireEvent.click(getByTestId("sale-item-save-21"));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t("inventorySales.sales.items.identifiers.fractionalNeedsClear")
    );
    expect(updateInventorySaleItem).not.toHaveBeenCalled();
  });

  it("integer → fractional B) após remover todos envia quantity 1.5 e identifiers []", async () => {
    const { getByDisplayValue, getByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            quantity: 2,
            identifiers: [
              { position: 1, identifier: "SN-A" },
              { position: 2, identifier: "SN-B" },
            ],
          }),
        ],
      }),
    });
    fireEvent.change(getByDisplayValue("2"), { target: { value: "1.5" } });
    fireEvent.click(getByTestId("sale-item-identifier-remove-all-21"));
    fireEvent.click(getByTestId("sale-item-save-21"));
    await waitFor(() => expect(updateInventorySaleItem).toHaveBeenCalled());
    expect(updateInventorySaleItem).toHaveBeenCalledWith(7, 21, {
      quantity: 1.5,
      unitPrice: 100,
      discountAmount: 0,
      identifiers: [],
    });
  });

  it("integer → fractional C) sem identifiers omite o campo", async () => {
    const { getByDisplayValue, getByTestId } = renderEditor({
      sale: saleBase({
        items: [itemBase({ quantity: 2, identifiers: [] })],
      }),
    });
    fireEvent.change(getByDisplayValue("2"), { target: { value: "1.5" } });
    fireEvent.click(getByTestId("sale-item-save-21"));
    await waitFor(() => expect(updateInventorySaleItem).toHaveBeenCalled());
    expect(updateInventorySaleItem.mock.calls[0][2]).toEqual({
      quantity: 1.5,
      unitPrice: 100,
      discountAmount: 0,
    });
    expect(updateInventorySaleItem.mock.calls[0][2]).not.toHaveProperty(
      "identifiers"
    );
  });

  it("integer → fractional D) venda antiga sem identifiers aceita fracionária", async () => {
    const { getByDisplayValue, getByTestId, queryByTestId } = renderEditor({
      sale: saleBase({
        items: [itemBase({ quantity: 2, identifiers: [] })],
      }),
    });
    fireEvent.change(getByDisplayValue("2"), { target: { value: "0.5" } });
    expect(queryByTestId("sale-item-identifier-input-21-1")).toBeNull();
    expect(getByTestId("sale-item-identifiers-fractional-21")).toBeTruthy();
    fireEvent.click(getByTestId("sale-item-save-21"));
    await waitFor(() => expect(updateInventorySaleItem).toHaveBeenCalled());
    expect(updateInventorySaleItem.mock.calls[0][2]).not.toHaveProperty(
      "identifiers"
    );
  });

  it("quantity 50 sparse carrega positions 1/7/30 e não renumera", () => {
    const { getByTestId, queryByTestId } = renderEditor({
      sale: saleBase({
        items: [
          itemBase({
            quantity: 50,
            identifiers: [
              { position: 1, identifier: "SN1" },
              { position: 7, identifier: "SN7" },
              { position: 30, identifier: "SN30" },
            ],
          }),
        ],
      }),
    });
    expect(getByTestId("sale-item-identifier-input-21-1").value).toBe("SN1");
    expect(getByTestId("sale-item-identifier-input-21-7").value).toBe("SN7");
    expect(getByTestId("sale-item-identifier-input-21-30").value).toBe("SN30");
    expect(queryByTestId("sale-item-identifier-input-21-2")).toBeNull();
    fireEvent.click(getByTestId("sale-item-identifier-remove-21-7"));
    expect(queryByTestId("sale-item-identifier-input-21-7")).toBeNull();
    expect(getByTestId("sale-item-identifier-input-21-30").value).toBe("SN30");
  });

  it("21. mobile empilha identifiers no card", async () => {
    useIsMobile.mockReturnValue(true);
    const { getByTestId } = renderEditor({
      sale: saleBase({
        items: [itemBase({ quantity: 2, identifiers: [] })],
      }),
    });
    fireEvent.click(getByTestId("sale-item-identifiers-toggle-21"));
    await waitFor(() => getByTestId("sale-item-identifier-input-21-1"));
    expect(getByTestId("sale-item-identifier-input-21-1")).toBeTruthy();
    expect(getByTestId("sale-item-identifier-input-21-2")).toBeTruthy();
  });
});
