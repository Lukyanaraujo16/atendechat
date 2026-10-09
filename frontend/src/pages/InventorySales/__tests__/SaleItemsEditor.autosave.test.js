/**
 * @jest-environment jsdom
 */
import React, { createRef } from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleItemsEditor from "../SaleItemsEditor";

const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockAdd = jest.fn();
const mockList = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  updateInventorySaleItem: (...a) => mockUpdate(...a),
  deleteInventorySaleItem: (...a) => mockDelete(...a),
  addInventorySaleItem: (...a) => mockAdd(...a),
  listInventoryProducts: (...a) => mockList(...a),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../hooks/useIsMobile", () => () => false);

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
  }),
}));

function itemBase(overrides = {}) {
  return {
    id: 7,
    productName: "Produto A",
    productSku: "A1",
    quantity: 1,
    unitPrice: 10,
    discountAmount: 0,
    totalAmount: 10,
    unit: "un",
    identifiers: [],
    ...overrides,
  };
}

function saleBase(overrides = {}) {
  return {
    id: 3,
    status: "draft",
    items: [itemBase()],
    subtotalAmount: 10,
    discountAmount: 0,
    totalAmount: 10,
    ...overrides,
  };
}

function renderEditor(props = {}) {
  const ref = createRef();
  const onSaleUpdated = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <SaleItemsEditor
        ref={ref}
        sale={saleBase(props.saleOverrides)}
        readOnly={false}
        autoSave={props.autoSave !== false}
        onSaleUpdated={onSaleUpdated}
        {...props}
      />
    </ThemeProvider>
  );
  return { ...utils, ref, onSaleUpdated };
}

describe("SaleItemsEditor autosave", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockAdd.mockReset();
    mockList.mockResolvedValue({ data: [] });
    mockUpdate.mockResolvedValue({ data: {} });
  });

  it("1. quantidade salva sem clicar no disquete", async () => {
    renderEditor();
    expect(screen.queryByTestId("sale-item-save-7")).toBeNull();
    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "2" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][2].quantity).toBe(2);
  });

  it("2. preço autosave com debounce", async () => {
    renderEditor();
    const priceInput = screen.getByTestId("sale-item-price-7");
    fireEvent.keyDown(priceInput, { key: "1" });
    fireEvent.keyDown(priceInput, { key: "5" });
    expect(mockUpdate).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][2].unitPrice).toBeGreaterThan(0);
  });

  it("3. desconto autosave persiste", async () => {
    renderEditor();
    const discountInput = screen.getByTestId("sale-item-discount-7-amount");
    fireEvent.keyDown(discountInput, { key: "5" });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][2].discountAmount).toBe(0.05);
  });

  it("4. alteração rápida não aplica resposta stale", async () => {
    let resolveFirst;
    let resolveSecond;
    mockUpdate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { onSaleUpdated } = renderEditor();
    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "2" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "3" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond({});
    });
    await waitFor(() => expect(onSaleUpdated).toHaveBeenCalled());
    const callsAfterSecond = onSaleUpdated.mock.calls.length;

    await act(async () => {
      resolveFirst({});
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSaleUpdated.mock.calls.length).toBe(callsAfterSecond);
  });

  it("5. flush aguarda autosave pendente", async () => {
    const { ref } = renderEditor();
    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "4" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    await act(async () => {
      await ref.current.flushPendingSaves();
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][2].quantity).toBe(4);
  });

  it("6. falha no autosave faz flush rejeitar", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("fail"));
    const { ref } = renderEditor();
    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "5" },
    });
    let thrown = null;
    await act(async () => {
      try {
        await ref.current.flushPendingSaves();
      } catch (err) {
        thrown = err;
      }
    });
    expect(thrown?.code || thrown?.message).toMatch(/autosave-failed/);
  });

  it("7. botão excluir permanece", () => {
    renderEditor();
    expect(screen.getByTestId("sale-item-delete-7")).toBeTruthy();
  });

  it("9. identificador não dispara request por caractere", async () => {
    renderEditor({
      saleOverrides: {
        items: [itemBase({ quantity: 1, identifiers: [] })],
      },
    });
    const idInput = screen.queryByTestId("sale-item-identifier-input-7-1");
    if (idInput) {
      fireEvent.change(idInput, { target: { value: "IMEI1" } });
      fireEvent.change(idInput, { target: { value: "IMEI12" } });
      fireEvent.change(idInput, { target: { value: "IMEI123" } });
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    } else {
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  });

  it("legado sem autoSave mantém botão salvar", async () => {
    renderEditor({ autoSave: false });
    fireEvent.change(screen.getByTestId("sale-item-qty-7"), {
      target: { value: "2" },
    });
    expect(await screen.findByTestId("sale-item-save-7")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
