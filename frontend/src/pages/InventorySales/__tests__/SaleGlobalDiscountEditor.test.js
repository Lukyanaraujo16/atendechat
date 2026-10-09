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
import SaleGlobalDiscountEditor, {
  buildGlobalDiscountBody,
  globalDraftFromSale,
  resolveGlobalDiscountType,
} from "../SaleGlobalDiscountEditor";
import {
  formatPercentDraftValue,
  parsePercentInput,
  sanitizePercentTyping,
} from "../inventoryPercentInput";

const mockUpdate = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  updateInventorySaleGlobalDiscount: (...a) => mockUpdate(...a),
}));
jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
    canApplyDiscount: true,
  }),
}));

function saleBase(overrides = {}) {
  return {
    id: 25,
    status: "draft",
    subtotalAmount: 29.9,
    discountAmount: 0,
    globalDiscountType: null,
    globalDiscountPercent: null,
    globalDiscountAmount: 0,
    freightAmount: 0,
    totalAmount: 29.9,
    ...overrides,
  };
}

function renderEditor(saleOverrides = {}, props = {}) {
  const onSaleUpdated = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <SaleGlobalDiscountEditor
        sale={saleBase(saleOverrides)}
        disabled={false}
        canApplyDiscount
        onSaleUpdated={onSaleUpdated}
        {...props}
      />
    </ThemeProvider>
  );
  return { ...utils, onSaleUpdated };
}

describe("resolveGlobalDiscountType / draft", () => {
  it("venda sem desconto inicia em %", () => {
    expect(resolveGlobalDiscountType(saleBase())).toBe("percentage");
    expect(globalDraftFromSale(saleBase()).globalDiscountType).toBe(
      "percentage"
    );
    expect(globalDraftFromSale(saleBase()).globalDiscountPercent).toBe("");
  });

  it("percentage existente permanece %", () => {
    expect(
      resolveGlobalDiscountType(
        saleBase({
          globalDiscountType: "percentage",
          globalDiscountPercent: 10,
          globalDiscountAmount: 2.99,
        })
      )
    ).toBe("percentage");
  });

  it("fixed existente permanece R$", () => {
    expect(
      resolveGlobalDiscountType(
        saleBase({
          globalDiscountType: "fixed",
          globalDiscountAmount: 0.3,
        })
      )
    ).toBe("fixed");
  });

  it("legado monetário sem type permanece R$", () => {
    expect(
      resolveGlobalDiscountType(
        saleBase({
          globalDiscountType: null,
          globalDiscountAmount: 5,
        })
      )
    ).toBe("fixed");
  });
});

describe("digitação percentual (helpers compartilhados)", () => {
  it("1 → 10 → 100 sem deslocar casas", () => {
    expect(sanitizePercentTyping("1")).toBe("1");
    expect(sanitizePercentTyping("10")).toBe("10");
    expect(sanitizePercentTyping("100")).toBe("100");
  });

  it("aceita 10,5 e payload numérico", () => {
    expect(sanitizePercentTyping("10,5")).toBe("10,5");
    expect(parsePercentInput("10,5")).toBe(10.5);
    expect(
      buildGlobalDiscountBody({
        globalDiscountType: "percentage",
        globalDiscountPercent: "10,5",
      })
    ).toEqual({
      globalDiscountType: "percentage",
      globalDiscountPercent: 10.5,
    });
  });

  it("não força zeros decimais", () => {
    expect(formatPercentDraftValue(0)).toBe("");
    expect(formatPercentDraftValue("0.00")).toBe("");
    expect(formatPercentDraftValue(10)).toBe("10");
  });

  it("campo vazio limpa desconto global", () => {
    expect(
      buildGlobalDiscountBody({
        globalDiscountType: "percentage",
        globalDiscountPercent: "",
      })
    ).toEqual({ clear: true });
  });
});

describe("SaleGlobalDiscountEditor UI", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ data: {} });
  });

  it("novo desconto inicia em % com campo vazio", () => {
    renderEditor();
    expect(
      screen.getByTestId("global-discount-type-percent").getAttribute("aria-pressed")
    ).toBe("true");
    const input = screen.getByTestId("global-discount-percent");
    expect(input.value).toBe("");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("inputmode") || input.getAttribute("inputMode")).toMatch(
      /decimal/i
    );
  });

  it("símbolo % visível e sem type=number", () => {
    renderEditor();
    const input = screen.getByTestId("global-discount-percent");
    expect(input.closest(".MuiInputBase-root")?.textContent || "").toMatch(/%/);
    expect(input.getAttribute("type")).not.toBe("number");
  });

  it("digitação 1 → 10 → 100 no campo", () => {
    renderEditor();
    fireEvent.change(screen.getByTestId("global-discount-percent"), {
      target: { value: "1" },
    });
    expect(screen.getByTestId("global-discount-percent").value).toBe("1");
    fireEvent.change(screen.getByTestId("global-discount-percent"), {
      target: { value: "10" },
    });
    expect(screen.getByTestId("global-discount-percent").value).toBe("10");
    fireEvent.change(screen.getByTestId("global-discount-percent"), {
      target: { value: "100" },
    });
    expect(screen.getByTestId("global-discount-percent").value).toBe("100");
  });

  it("digitação 10,5 preserva vírgula", () => {
    renderEditor();
    fireEvent.change(screen.getByTestId("global-discount-percent"), {
      target: { value: "10,5" },
    });
    expect(screen.getByTestId("global-discount-percent").value).toBe("10,5");
  });

  it("permite esvaziar o campo durante edição", () => {
    renderEditor({
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      globalDiscountAmount: 2.99,
    });
    fireEvent.change(screen.getByTestId("global-discount-percent"), {
      target: { value: "" },
    });
    expect(screen.getByTestId("global-discount-percent").value).toBe("");
  });

  it("autosave silencioso: sem Salvando e payload numérico", async () => {
    jest.useFakeTimers();
    try {
      renderEditor();
      fireEvent.change(screen.getByTestId("global-discount-percent"), {
        target: { value: "10" },
      });
      expect(screen.queryByText(/Salvando/i)).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][1]).toEqual({
        globalDiscountType: "percentage",
        globalDiscountPercent: 10,
      });
      expect(screen.queryByText(/Salvando/i)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("fixed existente permanece R$ e CurrencyInput", () => {
    renderEditor({
      globalDiscountType: "fixed",
      globalDiscountAmount: 0.3,
      totalAmount: 29.6,
    });
    expect(
      screen.getByTestId("global-discount-type-fixed").getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByTestId("global-discount-amount")).toBeTruthy();
    expect(screen.queryByTestId("global-discount-percent")).toBeNull();
  });

  it("alternância R$ → % limpa percentual e não pisca Salvando", async () => {
    jest.useFakeTimers();
    try {
      renderEditor({
        globalDiscountType: "fixed",
        globalDiscountAmount: 0.3,
      });
      fireEvent.click(screen.getByTestId("global-discount-type-percent"));
      expect(screen.getByTestId("global-discount-percent").value).toBe("");
      expect(screen.queryByText(/Salvando/i)).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][1]).toEqual({ clear: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it("percentage existente permanece %", () => {
    renderEditor({
      globalDiscountType: "percentage",
      globalDiscountPercent: 15,
      globalDiscountAmount: 4.485,
    });
    expect(
      screen.getByTestId("global-discount-type-percent").getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByTestId("global-discount-percent").value).toBe("15");
  });
});
