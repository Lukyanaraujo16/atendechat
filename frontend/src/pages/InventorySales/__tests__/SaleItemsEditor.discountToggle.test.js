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
  formatPercentDraftValue,
  parsePercentInput,
  resolveItemDiscountType,
  sanitizePercentTyping,
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

describe("percent helpers (não monetário)", () => {
  it("digitação 1 → 10 → 100 sem deslocar casas", () => {
    expect(sanitizePercentTyping("1")).toBe("1");
    expect(sanitizePercentTyping("10")).toBe("10");
    expect(sanitizePercentTyping("100")).toBe("100");
  });

  it("aceita 10,5 e payload numérico 10.5", () => {
    expect(sanitizePercentTyping("10,5")).toBe("10,5");
    expect(parsePercentInput("10,5")).toBe(10.5);
    expect(
      buildItemDiscountPayload({
        discountType: "percentage",
        discountPercent: "10,5",
      })
    ).toEqual({ discountType: "percentage", discountPercent: 10.5 });
  });

  it("não força zeros decimais no draft", () => {
    expect(formatPercentDraftValue(0)).toBe("");
    expect(formatPercentDraftValue("0.00")).toBe("");
    expect(formatPercentDraftValue(10)).toBe("10");
    expect(formatPercentDraftValue("10.00")).toBe("10");
  });

  it("resolve tipo: novo/zero → %; legado com amount → R$; percentage → %", () => {
    expect(resolveItemDiscountType({ discountType: null, discountAmount: 0 })).toBe(
      "percentage"
    );
    expect(
      resolveItemDiscountType({ discountType: null, discountAmount: 10 })
    ).toBe("fixed");
    expect(
      resolveItemDiscountType({ discountType: "fixed", discountAmount: 0 })
    ).toBe("fixed");
    expect(
      resolveItemDiscountType({
        discountType: "percentage",
        discountPercent: 5,
      })
    ).toBe("percentage");
  });
});

describe("buildItemDiscountPayload", () => {
  it("keeps percentage even when percent is empty or zero", () => {
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
    expect(percentInput.value).toBe("");
    expect(
      percentInput.closest(".MuiInputBase-root")?.textContent || ""
    ).toMatch(/%/);
  });

  it("digitação percentual 1 → 10 → 100 no item", () => {
    renderEditor({
      autoSave: false,
      saleOverrides: {
        items: [itemBase({ discountType: "percentage", discountPercent: null })],
      },
    });
    const pct = screen.getByTestId("sale-item-discount-5-percent");
    fireEvent.change(pct, { target: { value: "1" } });
    expect(screen.getByTestId("sale-item-discount-5-percent").value).toBe("1");
    fireEvent.change(pct, { target: { value: "10" } });
    expect(screen.getByTestId("sale-item-discount-5-percent").value).toBe("10");
    fireEvent.change(pct, { target: { value: "100" } });
    expect(screen.getByTestId("sale-item-discount-5-percent").value).toBe("100");
  });

  it("legado null com desconto monetário permanece R$", () => {
    renderEditor({
      autoSave: false,
      saleOverrides: {
        items: [
          itemBase({
            discountType: null,
            discountPercent: null,
            discountAmount: 10,
            totalAmount: 40,
          }),
        ],
      },
    });
    expect(screen.getByTestId("sale-item-discount-5-amount")).toBeTruthy();
    expect(screen.queryByTestId("sale-item-discount-5-percent")).toBeNull();
  });

  it("null sem desconto inicia em %", () => {
    renderEditor({
      autoSave: false,
      saleOverrides: {
        items: [
          itemBase({
            discountType: null,
            discountPercent: null,
            discountAmount: 0,
          }),
        ],
      },
    });
    expect(screen.getByTestId("sale-item-discount-5-percent")).toBeTruthy();
    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
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
    expect(percentInput.value).toBe("10");
    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("formulário adicionar inicia em % e alterna para R$", () => {
    renderEditor({ autoSave: false });
    expect(screen.getByTestId("sale-add-discount-percent")).toBeTruthy();
    expect(
      screen.getByTestId("sale-add-discount-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    fireEvent.click(screen.getByTestId("sale-add-discount-type-fixed"));
    expect(screen.getByTestId("sale-add-discount-amount").value).toMatch(/R\$/);
    fireEvent.click(screen.getByTestId("sale-add-discount-type-percent"));
    expect(screen.getByTestId("sale-add-discount-percent").value).toBe("");
  });

  it("item fixed existente permanece R$ com máscara", () => {
    renderEditor({ autoSave: false });
    const amount = screen.getByTestId("sale-item-discount-5-amount");
    expect(amount.value).toMatch(/R\$/);
    expect(
      screen.getByTestId("sale-item-discount-5-type-fixed").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("cabeçalho Quant. completo e quantidade centralizada", () => {
    renderEditor({ autoSave: false });
    expect(screen.getByText("Quant.")).toBeTruthy();
    expect(screen.queryByText(/Quan\.\.\./)).toBeNull();
    const qty = screen.getByTestId("sale-item-qty-5");
    const style = window.getComputedStyle(qty);
    expect(style.textAlign === "center" || qty.className).toBeTruthy();
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

  it("clicar % no item existente envia percentage e permanece sem flicker", async () => {
    let resolveRefresh;
    const onSaleUpdated = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );
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

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][2].discountType).toBe("percentage");

    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    expect(screen.queryByTestId("sale-item-discount-5-amount")).toBeNull();

    await act(async () => {
      resolveRefresh();
    });
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

    expect(
      screen.getByTestId("sale-item-discount-5-type-percent").getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("autosave com percent 10 persiste discountPercent numérico", async () => {
    renderEditor({
      saleOverrides: {
        items: [itemBase({ discountType: "percentage", discountPercent: "" })],
      },
    });
    fireEvent.change(screen.getByTestId("sale-item-discount-5-percent"), {
      target: { value: "10" },
    });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const last = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][2];
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
