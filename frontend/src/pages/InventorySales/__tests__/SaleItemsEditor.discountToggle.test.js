/**
 * @jest-environment jsdom
 */
import React, { createRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleItemsEditor, {
  buildItemDiscountPayload,
} from "../SaleItemsEditor";

const mockUpdate = jest.fn();
const mockAdd = jest.fn();
const mockDelete = jest.fn();
const mockList = jest.fn(() => Promise.resolve({ data: [] }));
const mockToastError = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  updateInventorySaleItem: (...a) => mockUpdate(...a),
  deleteInventorySaleItem: (...a) => mockDelete(...a),
  addInventorySaleItem: (...a) => mockAdd(...a),
  listInventoryProducts: (...a) => mockList(...a),
}));
jest.mock("../../../errors/toastError", () => (...a) => mockToastError(...a));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../hooks/useIsMobile", () => () => false);
jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
    canApplyDiscount: true,
  }),
}));

function itemBase(overrides = {}) {
  return {
    id: 5,
    productName: "P",
    quantity: 1,
    unitPrice: 50,
    discountType: "fixed",
    discountAmount: 0,
    totalAmount: 50,
    identifiers: [],
    ...overrides,
  };
}

function renderEditor({ saleOverrides, autoSave = true, ...rest } = {}) {
  const ref = createRef();
  const onSaleUpdated = jest.fn().mockResolvedValue(undefined);
  const sale = {
    id: 1,
    status: "draft",
    items: [itemBase()],
    ...saleOverrides,
  };
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <SaleItemsEditor
        ref={ref}
        sale={sale}
        readOnly={false}
        autoSave={autoSave}
        onSaleUpdated={onSaleUpdated}
        {...rest}
      />
    </ThemeProvider>
  );
  return { ...utils, ref, onSaleUpdated, sale };
}

describe("buildItemDiscountPayload", () => {
  it("keeps percentage even when percent is empty or zero (bug root cause)", () => {
    expect(
      buildItemDiscountPayload({ discountType: "percentage", discountPercent: "" })
    ).toEqual({ discountType: "percentage", discountPercent: 0 });
    expect(
      buildItemDiscountPayload({ discountType: "percentage", discountPercent: "0" })
    ).toEqual({ discountType: "percentage", discountPercent: 0 });
  });

  it("sends numeric percent without forcing fixed", () => {
    expect(
      buildItemDiscountPayload({
        discountType: "percentage",
        discountPercent: "10",
      })
    ).toEqual({ discountType: "percentage", discountPercent: 10 });
  });

  it("fixed keeps monetary line discount", () => {
    expect(
      buildItemDiscountPayload({
        discountType: "fixed",
        discountAmount: "10",
      })
    ).toEqual({ discountType: "fixed", discountAmount: 10 });
  });
});

describe("SaleItemsEditor discount toggle", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockUpdate.mockReset();
    mockAdd.mockReset();
    mockDelete.mockReset();
    mockToastError.mockReset();
    mockUpdate.mockResolvedValue({ data: {} });
  });

  it("switches row discount input between R$ and %", () => {
    renderEditor({ autoSave: false });
    expect(screen.getByTestId("sale-item-discount-5-amount")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    const percentInput = screen.getByTestId("sale-item-discount-5-percent");
    expect(percentInput).toBeTruthy();
    // Adornment "%" (além do botão do toggle)
    expect(
      percentInput.closest(".MuiInputBase-root")?.textContent || ""
    ).toMatch(/%/);
  });

  it("legado null discountType inicia em R$", () => {
    renderEditor({
      autoSave: false,
      saleOverrides: {
        items: [itemBase({ discountType: null, discountPercent: null })],
      },
    });
    expect(screen.getByTestId("sale-item-discount-5-amount")).toBeTruthy();
    expect(screen.queryByTestId("sale-item-discount-5-percent")).toBeNull();
  });

  it("item percentage reidrata com % selecionado e valor", () => {
    renderEditor({
      autoSave: false,
      saleOverrides: {
        items: [
          itemBase({
            discountType: "percentage",
            discountPercent: 10,
            discountAmount: 5,
            totalAmount: 45,
          }),
        ],
      },
    });
    const percentInput = screen.getByTestId("sale-item-discount-5-percent");
    expect(percentInput).toBeTruthy();
    expect(percentInput.value).toBe("10");
    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("formulário novo alterna R$ ↔ % com adornment", () => {
    renderEditor({ autoSave: false });
    expect(screen.getByTestId("sale-add-discount-amount").value).toMatch(/R\$/);
    fireEvent.click(screen.getByTestId("sale-add-discount-type-percent"));
    const pct = screen.getByTestId("sale-add-discount-percent");
    expect(pct.closest(".MuiInputBase-root")?.textContent || "").toMatch(/%/);
    fireEvent.click(screen.getByTestId("sale-add-discount-type-fixed"));
    expect(screen.getByTestId("sale-add-discount-amount").value).toMatch(/R\$/);
  });

  it("monetário mostra máscara R$", () => {
    renderEditor({ autoSave: false });
    const amount = screen.getByTestId("sale-item-discount-5-amount");
    expect(amount.value).toMatch(/R\$/);
  });
});

describe("SaleItemsEditor discount autosave persistence", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdate.mockReset();
    mockToastError.mockReset();
    mockUpdate.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("clicar % no item existente envia percentage (não fixed) e permanece após reidratação", async () => {
    const onSaleUpdated = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            status: "draft",
            items: [itemBase({ discountType: "fixed", discountAmount: 0 })],
          }}
          readOnly={false}
          autoSave
          onSaleUpdated={onSaleUpdated}
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    expect(screen.getByTestId("sale-item-discount-5-percent")).toBeTruthy();
    expect(screen.queryByTestId("sale-item-autosaving-5")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const body = mockUpdate.mock.calls[0][2];
    expect(body.discountType).toBe("percentage");
    expect(body.discountPercent).toBe(0);
    expect(body.discountType).not.toBe("fixed");

    expect(screen.queryByTestId("sale-item-autosaving-5")).toBeNull();

    await waitFor(() => expect(onSaleUpdated).toHaveBeenCalled());

    rerender(
      <ThemeProvider theme={createTheme()}>
        <SaleItemsEditor
          sale={{
            id: 1,
            status: "draft",
            items: [
              itemBase({
                discountType: "percentage",
                discountPercent: 0,
                discountAmount: 0,
                totalAmount: 50,
              }),
            ],
          }}
          readOnly={false}
          autoSave
          onSaleUpdated={onSaleUpdated}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId("sale-item-discount-5-percent")).toBeTruthy();
    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("autosave com percent 10 persiste discountPercent", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    fireEvent.change(screen.getByTestId("sale-item-discount-5-percent"), {
      target: { value: "10" },
    });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const bodies = mockUpdate.mock.calls.map((c) => c[2]);
    const last = bodies[bodies.length - 1];
    expect(last.discountType).toBe("percentage");
    expect(last.discountPercent).toBe(10);
  });

  it("autosave normal não mostra Salvando", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByText(/Salvando/i)).toBeNull();
    expect(screen.queryByTestId("sale-item-autosaving-5")).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(screen.queryByText(/Salvando/i)).toBeNull();
  });

  it("falha de autosave continua com feedback de erro", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("network"));
    renderEditor();
    fireEvent.click(screen.getByTestId("sale-item-discount-5-type-percent"));
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(await screen.findByTestId("sale-item-autosave-error-5")).toBeTruthy();
  });
});
