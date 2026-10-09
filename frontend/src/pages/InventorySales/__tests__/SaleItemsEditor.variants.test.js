/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import SaleItemsEditor from "../SaleItemsEditor";
import {
  addInventorySaleItem,
  listInventoryProducts,
  listInventoryProductVariants,
} from "../../../services/inventoryApi";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

if (typeof document.createRange !== "function") {
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    }),
    getClientRects: () => [],
  });
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 24,
    top: 0,
    left: 0,
    bottom: 24,
    right: 120,
  }));
});

jest.mock("../../../services/inventoryApi", () => ({
  addInventorySaleItem: jest.fn(),
  updateInventorySaleItem: jest.fn(),
  deleteInventorySaleItem: jest.fn(),
  listInventoryProducts: jest.fn(() => Promise.resolve({ data: [] })),
  listInventoryProductVariants: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
  }),
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

const theme = createTheme();

function renderEditor() {
  return render(
    <ThemeProvider theme={theme}>
      <SaleItemsEditor
        sale={{
          id: 7,
          status: "draft",
          items: [],
          subtotalAmount: "0",
          discountAmount: "0",
          totalAmount: "0",
        }}
        readOnly={false}
        onSaleUpdated={jest.fn()}
      />
    </ThemeProvider>
  );
}

describe("SaleItemsEditor — produto variável", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listInventoryProducts.mockResolvedValue({
      data: [
        {
          id: 50,
          name: "Camiseta",
          productKind: "variable",
          salePrice: 0,
          trackStock: false,
          aggregatedQuantity: 12,
          active: true,
        },
      ],
    });
    listInventoryProductVariants.mockResolvedValue({
      data: [
        {
          id: 901,
          label: "P / Azul",
          salePrice: 49.9,
          trackStock: true,
          currentQuantity: 5,
          active: true,
        },
      ],
    });
  });

  it("exige variação ao adicionar produto variável sem escolher variante", async () => {
    jest.useFakeTimers();
    try {
      renderEditor();
      fireEvent.change(screen.getByTestId("sale-product-search"), {
        target: { value: "Camiseta" },
      });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await waitFor(() => expect(listInventoryProducts).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("option", { name: /Camiseta/ }));

      await waitFor(() => {
        expect(listInventoryProductVariants).toHaveBeenCalledWith(50, {
          active: true,
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Adicionar item"));
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Selecione uma variação antes de adicionar o item."
      );
      expect(addInventorySaleItem).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("envia variantId ao confirmar a variação e adicionar", async () => {
    addInventorySaleItem.mockResolvedValue({ data: {} });
    jest.useFakeTimers();
    try {
      renderEditor();
      fireEvent.change(screen.getByTestId("sale-product-search"), {
        target: { value: "Camiseta" },
      });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await waitFor(() => expect(listInventoryProducts).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("option", { name: /Camiseta/ }));

      await waitFor(() => {
        expect(screen.getByText("Escolher variação")).toBeTruthy();
      });

      fireEvent.click(screen.getByText("Usar variação"));

      await act(async () => {
        fireEvent.click(screen.getByText("Adicionar item"));
      });

      await waitFor(() => {
        expect(addInventorySaleItem).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            productId: 50,
            variantId: 901,
            quantity: 1,
          })
        );
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
