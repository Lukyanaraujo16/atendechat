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
  within,
} from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SalePaymentsSection from "../SalePaymentsSection";
import {
  addInventorySalePayment,
  deleteInventorySalePaymentLine,
  getInventorySalePayments,
  settleInventorySalePaymentLine,
  updateInventorySalePaymentLine,
} from "../../../services/inventoryApi";

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySalePayments: jest.fn(),
  addInventorySalePayment: jest.fn(),
  updateInventorySalePaymentLine: jest.fn(),
  deleteInventorySalePaymentLine: jest.fn(),
  settleInventorySalePaymentLine: jest.fn(),
}));

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

const theme = createTheme();

function baseSale(overrides = {}) {
  return {
    id: 90,
    status: "completed",
    totalAmount: 1000,
    paidAmount: 1000,
    paymentStatus: "paid",
    paymentMethod: null,
    ...overrides,
  };
}

function summary(overrides = {}) {
  return {
    totalAmount: 1000,
    effectivePaid: 1000,
    pendingAmount: 0,
    remainingToReceive: 0,
    remainingToAllocate: 0,
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: 1,
    method: "cash",
    amount: 200,
    status: "paid",
    cardInstallmentCount: null,
    paidAt: "2026-10-07T14:30:00.000Z",
    notes: null,
    ...overrides,
  };
}

function renderSection(sale, props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SalePaymentsSection
        sale={sale}
        canManagePayments
        onSaleMaybeChanged={jest.fn()}
        {...props}
      />
    </ThemeProvider>
  );
}

describe("SalePaymentsSection", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
  });

  it("mostra loading enquanto busca pagamentos", async () => {
    let resolve;
    getInventorySalePayments.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    renderSection(baseSale());
    expect(screen.getByTestId("sale-payments-loading")).toBeTruthy();
    await act(async () => {
      resolve({
        data: {
          payments: [payment()],
          summary: summary({ effectivePaid: 200, remainingToReceive: 800 }),
        },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId("sale-payments-section")).toBeTruthy()
    );
  });

  it("lista split pago com resumo e sem ações destrutivas", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({ id: 1, method: "cash", amount: 200 }),
          payment({ id: 2, method: "pix", amount: 300 }),
          payment({
            id: 3,
            method: "credit_card",
            amount: 500,
            cardInstallmentCount: 5,
          }),
        ],
        summary: summary(),
      },
    });
    renderSection(baseSale());
    await screen.findByTestId("sale-payments-section");

    const sum = screen.getByTestId("sale-payments-summary");
    expect(sum.textContent).toMatch(/1\.000/);
    expect(screen.getByTestId("sale-payments-fully-paid").textContent).toMatch(
      /Pago integralmente/
    );
    expect(screen.getByText("Dinheiro")).toBeTruthy();
    expect(screen.getByText("PIX")).toBeTruthy();
    expect(screen.getByText(/Cartão de crédito/)).toBeTruthy();
    expect(screen.getByText(/5x/)).toBeTruthy();
    expect(screen.queryByTestId("sale-payment-edit-1")).toBeNull();
    expect(screen.queryByTestId("sale-payment-remove-1")).toBeNull();
    expect(screen.queryByTestId("sale-payments-add")).toBeNull();
  });

  it("paid+pending mostra ações só no pending e settle atualiza", async () => {
    const onChanged = jest.fn();
    getInventorySalePayments
      .mockResolvedValueOnce({
        data: {
          payments: [
            payment({ id: 1, method: "cash", amount: 200 }),
            payment({
              id: 2,
              method: "boleto",
              amount: 800,
              status: "pending",
              paidAt: null,
            }),
          ],
          summary: summary({
            effectivePaid: 200,
            pendingAmount: 800,
            remainingToReceive: 800,
            remainingToAllocate: 0,
          }),
        },
      })
      .mockResolvedValue({
        data: {
          payments: [
            payment({ id: 1, method: "cash", amount: 200 }),
            payment({ id: 2, method: "boleto", amount: 800, status: "paid" }),
          ],
          summary: summary(),
        },
      });

    settleInventorySalePaymentLine.mockResolvedValue({
      data: {
        payments: [
          payment({ id: 1, method: "cash", amount: 200 }),
          payment({ id: 2, method: "boleto", amount: 800, status: "paid" }),
        ],
        summary: summary(),
      },
    });

    renderSection(baseSale({ paidAmount: 200, paymentStatus: "partial" }), {
      onSaleMaybeChanged: onChanged,
    });
    await screen.findByTestId("sale-payments-section");

    expect(screen.queryByTestId("sale-payment-edit-1")).toBeNull();
    expect(screen.getByTestId("sale-payment-edit-2")).toBeTruthy();
    expect(screen.getByTestId("sale-payment-settle-2")).toBeTruthy();
    expect(screen.getByTestId("sale-payment-remove-2")).toBeTruthy();
    expect(screen.queryByTestId("sale-payments-add")).toBeNull();

    fireEvent.click(screen.getByTestId("sale-payment-settle-2"));
    expect(screen.getByTestId("sale-payments-settle-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sale-payments-settle-submit"));

    await waitFor(() =>
      expect(settleInventorySalePaymentLine).toHaveBeenCalledWith(
        90,
        2,
        expect.objectContaining({ paidAt: expect.any(String) })
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("sale-payment-settle-2")).toBeNull()
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("edita pending via PUT e preserva estado em erro", async () => {
    const toastError = require("../../../errors/toastError");
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    updateInventorySalePaymentLine.mockRejectedValueOnce(new Error("fail"));

    renderSection(baseSale({ paidAmount: 0, paymentStatus: "unpaid" }));
    await screen.findByTestId("sale-payments-section");

    fireEvent.click(screen.getByTestId("sale-payment-edit-2"));
    const dialog = screen.getByTestId("sale-payments-edit-dialog");
    expect(within(dialog).getByDisplayValue(/800,00/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("sale-payments-edit-submit"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByTestId("sale-payments-edit-dialog")).toBeTruthy();
    expect(screen.getByTestId(`sale-payment-row-2`).textContent).toMatch(/800/);
  });

  it("salva edição pending e atualiza summary", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
            notes: "obs",
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    updateInventorySalePaymentLine.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "pix",
            amount: 800,
            status: "pending",
            paidAt: null,
            notes: "nova",
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });

    renderSection(baseSale({ paidAmount: 0 }));
    await screen.findByTestId("sale-payments-section");
    fireEvent.click(screen.getByTestId("sale-payment-edit-2"));

    const notes = screen.getByTestId("sale-payments-notes");
    fireEvent.change(notes, { target: { value: "nova" } });

    fireEvent.click(screen.getByTestId("sale-payments-edit-submit"));
    await waitFor(() =>
      expect(updateInventorySalePaymentLine).toHaveBeenCalledWith(
        90,
        2,
        expect.objectContaining({
          method: "boleto",
          amount: 800,
          notes: "nova",
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("sale-payments-edit-dialog")).toBeNull()
    );
  });

  it("remove pending com confirmação", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    deleteInventorySalePaymentLine.mockResolvedValue({
      data: { payments: [], summary: summary({ remainingToAllocate: 1000 }) },
    });

    renderSection(baseSale({ paidAmount: 0 }));
    await screen.findByTestId("sale-payments-section");
    fireEvent.click(screen.getByTestId("sale-payment-remove-2"));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));

    await waitFor(() =>
      expect(deleteInventorySalePaymentLine).toHaveBeenCalledWith(90, 2)
    );
  });

  it("sem managePayments é somente leitura", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    renderSection(baseSale({ paidAmount: 0 }), { canManagePayments: false });
    await screen.findByTestId("sale-payments-section");
    expect(screen.queryByTestId("sale-payment-edit-2")).toBeNull();
    expect(screen.queryByTestId("sale-payments-add")).toBeNull();
  });

  it("cancelled não permite mutation", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    renderSection(
      baseSale({ status: "cancelled", paidAmount: 0, paymentStatus: "unpaid" })
    );
    await screen.findByTestId("sale-payments-section");
    expect(screen.queryByTestId("sale-payment-edit-2")).toBeNull();
    expect(screen.queryByTestId("sale-payments-add")).toBeNull();
  });

  it("saldo não alocado abre add com remainingToAllocate", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [payment({ id: 1, method: "cash", amount: 200 })],
        summary: summary({
          effectivePaid: 200,
          pendingAmount: 0,
          remainingToReceive: 800,
          remainingToAllocate: 800,
        }),
      },
    });
    addInventorySalePayment.mockResolvedValue({
      data: {
        payments: [
          payment({ id: 1, method: "cash", amount: 200 }),
          payment({ id: 2, method: "pix", amount: 800 }),
        ],
        summary: summary(),
      },
    });

    renderSection(baseSale({ paidAmount: 200, paymentStatus: "partial" }));
    await screen.findByTestId("sale-payments-section");
    fireEvent.click(screen.getByTestId("sale-payments-add"));
    const dialog = screen.getByTestId("sale-payments-add-dialog");
    expect(within(dialog).getByDisplayValue(/800,00/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("sale-payments-add-submit"));

    await waitFor(() =>
      expect(addInventorySalePayment).toHaveBeenCalledWith(
        90,
        expect.objectContaining({ method: "cash", amount: 800, status: "paid" })
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("sale-payments-add")).toBeNull()
    );
  });

  it("fully allocated esconde adicionar mesmo com pending", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({ id: 1, amount: 200 }),
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 200,
          pendingAmount: 800,
          remainingToReceive: 800,
          remainingToAllocate: 0,
        }),
      },
    });
    renderSection(baseSale({ paidAmount: 200, paymentStatus: "partial" }));
    await screen.findByTestId("sale-payments-section");
    expect(screen.queryByTestId("sale-payments-add")).toBeNull();
  });

  it("fallback legado sem lines", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: { payments: [], summary: null },
    });
    renderSection(
      baseSale({
        paymentMethod: "pix",
        paidAmount: 500,
        paymentStatus: "partial",
        totalAmount: 1000,
      })
    );
    await screen.findByTestId("sale-payments-legacy");
    expect(screen.getByTestId("sale-payment-method-display").textContent).toBe(
      "PIX"
    );
  });

  it("bloqueia double submit no settle", async () => {
    getInventorySalePayments.mockResolvedValue({
      data: {
        payments: [
          payment({
            id: 2,
            method: "boleto",
            amount: 800,
            status: "pending",
            paidAt: null,
          }),
        ],
        summary: summary({
          effectivePaid: 0,
          pendingAmount: 800,
          remainingToReceive: 1000,
          remainingToAllocate: 200,
        }),
      },
    });
    let resolveSettle;
    settleInventorySalePaymentLine.mockReturnValue(
      new Promise((r) => {
        resolveSettle = r;
      })
    );

    renderSection(baseSale({ paidAmount: 0 }));
    await screen.findByTestId("sale-payments-section");
    fireEvent.click(screen.getByTestId("sale-payment-settle-2"));
    const submit = screen.getByTestId("sale-payments-settle-submit");
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(settleInventorySalePaymentLine).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSettle({
        data: {
          payments: [payment({ id: 2, method: "boleto", amount: 800 })],
          summary: summary(),
        },
      });
    });
  });
});
