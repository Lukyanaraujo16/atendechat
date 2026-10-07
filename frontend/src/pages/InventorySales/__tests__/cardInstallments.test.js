/**
 * @jest-environment jsdom
 */
import React from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import SaleDrawer from "../SaleDrawer";
import SalePaymentDialog from "../SalePaymentDialog";
import SaleReceiptContent from "../SaleReceiptContent";
import { formatCardInstallmentCaption } from "../cardInstallments";
import {
  getInventorySale,
  searchInventoryCustomers,
  updateInventorySale,
  updateInventorySalePayment,
} from "../../../services/inventoryApi";
import api from "../../../services/api";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../SaleItemsEditor", () => () => <div data-testid="sale-items-editor" />);

jest.mock("../SaleReceiptDialog", () => () => null);

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: () => false,
}));

const mockPerms = {
  canCreateSale: true,
  canManagePayments: true,
  canCancelSale: true,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySale: jest.fn(),
  updateInventorySale: jest.fn(),
  updateInventorySalePayment: jest.fn(),
  completeInventorySale: jest.fn(),
  cancelInventorySale: jest.fn(),
  deleteInventorySale: jest.fn(),
  searchInventoryCustomers: jest.fn(),
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

jest.setTimeout(20000);

function draftSale(overrides = {}) {
  return {
    id: 12,
    status: "draft",
    saleNumber: -12,
    contactId: null,
    contact: null,
    sellerUserId: 3,
    seller: { id: 3, name: "Vendedor Souza" },
    notes: "",
    paymentMethod: null,
    cardInstallmentCount: null,
    paymentNotes: null,
    paymentStatus: "unpaid",
    paidAmount: 0,
    paidAt: null,
    subtotalAmount: 1000,
    discountAmount: 0,
    totalAmount: 1000,
    items: [],
    ...overrides,
  };
}

function renderDrawer(sale = draftSale()) {
  getInventorySale.mockResolvedValue({ data: sale });
  return render(
    <ThemeProvider theme={theme}>
      <SaleDrawer open saleId={sale.id} onClose={jest.fn()} />
    </ThemeProvider>
  );
}

async function ready() {
  await screen.findByTestId("sale-items-editor");
}

function openSelect(testId) {
  fireEvent.mouseDown(screen.getByTestId(testId));
}

describe("parcelas do cartão no drawer", () => {
  beforeEach(() => {
    changeLanguage("pt");
    mockPerms.canManagePayments = true;
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [{ id: 3, name: "Vendedor Souza" }] });
    searchInventoryCustomers.mockResolvedValue({ data: { customers: [] } });
    updateInventorySale.mockResolvedValue({ data: draftSale() });
    updateInventorySalePayment.mockImplementation(async (_id, body) => ({
      data: draftSale({
        paymentMethod: body.paymentMethod,
        cardInstallmentCount: body.cardInstallmentCount,
        paymentStatus: "unpaid",
        paidAmount: 0,
      }),
    }));
  });

  it("mostra Parcelas de 1x a 18x, começa em 1x e grava 6x", async () => {
    renderDrawer();
    await ready();

    expect(screen.queryByTestId("sale-card-installments")).toBeNull();
    fireEvent.mouseDown(screen.getByLabelText("Forma de pagamento"));
    fireEvent.click(screen.getByRole("option", { name: "Cartão de crédito" }));

    const installments = screen.getByTestId("sale-card-installments");
    expect(installments.textContent).toBe("1x");
    expect(screen.getByTestId("sale-card-installment-caption").textContent).toBe(
      formatCardInstallmentCaption(1, 1000)
    );

    openSelect("sale-card-installments");
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(Array.from({ length: 18 }, (_, index) => `${index + 1}x`));
    fireEvent.click(screen.getByRole("option", { name: "6x" }));
    expect(screen.getByTestId("sale-card-installments").textContent).toBe("6x");
    expect(screen.getByTestId("sale-card-installment-caption").textContent).toContain(
      "6x"
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar pagamento" }));
    await waitFor(() => expect(updateInventorySalePayment).toHaveBeenCalledTimes(1));
    expect(updateInventorySalePayment.mock.calls[0][1]).toMatchObject({
      paymentMethod: "credit_card",
      cardInstallmentCount: 6,
      paymentStatus: "unpaid",
      paidAmount: 0,
    });
  });

  it("troca cartão por PIX, limpa as parcelas e volta em 1x", async () => {
    renderDrawer(
      draftSale({ paymentMethod: "credit_card", cardInstallmentCount: 6, totalAmount: 1800 })
    );
    await ready();
    expect(screen.getByTestId("sale-card-installments").textContent).toBe("6x");
    expect(screen.getByTestId("sale-card-installment-caption").textContent).toBe(
      `6x de ${formatCurrencyBRL(300)}`
    );

    fireEvent.mouseDown(screen.getByLabelText("Forma de pagamento"));
    fireEvent.click(screen.getByRole("option", { name: "PIX" }));
    expect(screen.queryByTestId("sale-card-installments")).toBeNull();
    expect(screen.queryByText(/6x/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Guardar pagamento" }));
    await waitFor(() => expect(updateInventorySalePayment).toHaveBeenCalledTimes(1));
    expect(updateInventorySalePayment.mock.calls[0][1].paymentMethod).toBe("pix");
    expect(updateInventorySalePayment.mock.calls[0][1].cardInstallmentCount).toBeNull();

    fireEvent.mouseDown(screen.getByLabelText("Forma de pagamento"));
    fireEvent.click(screen.getByRole("option", { name: "Cartão de crédito" }));
    expect(screen.getByTestId("sale-card-installments").textContent).toBe("1x");
  });

  it("venda histórica de cartão sem parcelas aparece como 1x e não pede novo recebimento", async () => {
    renderDrawer(
      draftSale({
        status: "completed",
        saleNumber: 40,
        paymentMethod: "credit_card",
        cardInstallmentCount: null,
        paymentStatus: "paid",
        paidAmount: 1000,
        totalAmount: 1000,
        paidAt: "2026-10-06T12:00:00.000Z",
      })
    );
    await ready();

    const display = screen.getByTestId("sale-payment-method-display").textContent;
    expect(display).toContain("Cartão de crédito");
    expect(display).toContain("1x");
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);
    expect(screen.getByText(/Valor pago/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /receber/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Atualizar pagamento" })).toBeTruthy();

    const src = fs.readFileSync(path.join(__dirname, "../SaleDrawer.js"), "utf8");
    const dataAt = src.indexOf("sections.saleData");
    const itemsAt = src.indexOf("<SaleItemsEditor");
    const paymentAt = src.indexOf("sales.payment.sectionTitle");
    const summaryAt = src.indexOf("sections.summary");
    expect(dataAt).toBeLessThan(itemsAt);
    expect(itemsAt).toBeLessThan(paymentAt);
    expect(paymentAt).toBeLessThan(summaryAt);
  });

  it("sem managePayments o rascunho não oferece parcelas editáveis", async () => {
    mockPerms.canManagePayments = false;
    renderDrawer(draftSale({ paymentMethod: "pix" }));
    await ready();
    expect(screen.queryByTestId("sale-card-installments")).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar pagamento" })).toBeNull();
    expect(screen.getByTestId("sale-payment-method-display").textContent).toBe("PIX");
  });
});

describe("divisão informativa e diálogo já pago", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    updateInventorySalePayment.mockResolvedValue({ data: {} });
  });

  it("não apresenta 3 × 333,33 como se fechasse R$ 1.000,00", () => {
    const caption = formatCardInstallmentCaption(3, 1000);
    expect(caption).toBe(`3x — total ${formatCurrencyBRL(1000)}`);
    expect(caption).not.toContain("333");
  });

  it("diálogo de venda paga em cartão não duplica o valor e devolve as parcelas", async () => {
    const onSaved = jest.fn();
    render(
      <ThemeProvider theme={theme}>
        <SalePaymentDialog
          open
          onClose={jest.fn()}
          onSaved={onSaved}
          sale={draftSale({
            status: "completed",
            paymentMethod: "credit_card",
            cardInstallmentCount: 6,
            paymentStatus: "paid",
            paidAmount: 1000,
            totalAmount: 1000,
          })}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId("sale-payment-dialog-installments").textContent).toBe("6x");
    expect(screen.getByDisplayValue(/1\.000,00/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /receber/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Guardar pagamento" }));
    await waitFor(() => expect(updateInventorySalePayment).toHaveBeenCalledTimes(1));
    expect(updateInventorySalePayment.mock.calls[0][1]).toMatchObject({
      paymentStatus: "paid",
      paymentMethod: "credit_card",
      cardInstallmentCount: 6,
      paidAmount: 1000,
    });
  });

  it("venda histórica no diálogo mostra 1x e não grava 1 se ninguém alterar", async () => {
    render(
      <ThemeProvider theme={theme}>
        <SalePaymentDialog
          open
          onClose={jest.fn()}
          sale={draftSale({
            status: "completed",
            paymentMethod: "credit_card",
            cardInstallmentCount: null,
            paymentStatus: "paid",
            paidAmount: 1000,
            totalAmount: 1000,
          })}
        />
      </ThemeProvider>
    );
    expect(screen.getByTestId("sale-payment-dialog-installments").textContent).toBe("1x");
    fireEvent.click(screen.getByRole("button", { name: "Guardar pagamento" }));
    await waitFor(() => expect(updateInventorySalePayment).toHaveBeenCalledTimes(1));
    expect(updateInventorySalePayment.mock.calls[0][1]).not.toHaveProperty(
      "cardInstallmentCount"
    );
    expect(updateInventorySalePayment.mock.calls[0][1].paidAmount).toBe(1000);
  });
});

describe("recibo de cartão", () => {
  beforeEach(() => {
    changeLanguage("pt");
  });

  function renderReceipt(sale, layout = "screen", format) {
    return render(
      <ThemeProvider theme={theme}>
        <SaleReceiptContent sale={sale} layout={layout} format={format} />
      </ThemeProvider>
    );
  }

  function visibleText() {
    return document.body.textContent.replace(/\u00a0/g, " ");
  }

  function money(value) {
    return formatCurrencyBRL(value).replace(/\u00a0/g, " ");
  }

  it("mostra 6x exato, histórico como 1x e omite parcelas no PIX", () => {
    const { rerender } = renderReceipt(
      draftSale({
        status: "completed",
        paymentMethod: "credit_card",
        cardInstallmentCount: 6,
        totalAmount: 1800,
        paymentStatus: "paid",
        paidAmount: 1800,
      })
    );
    expect(visibleText()).toContain(`Cartão de crédito — 6x de ${money(300)}`);

    rerender(
      <ThemeProvider theme={theme}>
        <SaleReceiptContent
          sale={draftSale({
            status: "completed",
            paymentMethod: "credit_card",
            cardInstallmentCount: null,
            totalAmount: 1800,
            paymentStatus: "paid",
            paidAmount: 1800,
          })}
        />
      </ThemeProvider>
    );
    expect(visibleText()).toContain(`Cartão de crédito — 1x de ${money(1800)}`);

    rerender(
      <ThemeProvider theme={theme}>
        <SaleReceiptContent
          sale={draftSale({
            paymentMethod: "pix",
            cardInstallmentCount: 6,
            totalAmount: 1800,
          })}
        />
      </ThemeProvider>
    );
    expect(visibleText()).toContain("PIX");
    expect(visibleText()).not.toContain("6x");
  });

  it("térmica 80mm e 58mm só acrescentam o texto, sem mudar a geometria", () => {
    const sale = draftSale({
      status: "completed",
      paymentMethod: "credit_card",
      cardInstallmentCount: 6,
      totalAmount: 1800,
      paymentStatus: "paid",
      paidAmount: 1800,
    });
    const { rerender } = renderReceipt(sale, "print", "thermal80");
    expect(document.querySelector(".sale-receipt-thermal")).toBeTruthy();
    expect(document.body.textContent).toContain(
      `Cartão de crédito — 6x de ${formatCurrencyBRL(300)}`
    );

    rerender(
      <ThemeProvider theme={theme}>
        <SaleReceiptContent sale={sale} layout="print" format="thermal58" />
      </ThemeProvider>
    );
    expect(document.querySelector(".sale-receipt-thermal")).toBeTruthy();

    const printSource = fs.readFileSync(
      path.join(__dirname, "../printSaleReceipt.js"),
      "utf8"
    );
    expect(printSource).toContain("@page");
    expect(printSource).not.toContain("cardInstallmentCount");
  });
});
