/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import { changeLanguage } from "../../../translate/i18n";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import useIsMobile from "../../../hooks/useIsMobile";
import SaleReceiptDialog from "../SaleReceiptDialog";
import { printSaleReceipt, waitForPrintResources } from "../printSaleReceipt";

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MutationObserverMock;

const theme = createTheme();
const originalAppend = HTMLElement.prototype.appendChild;

let printMode = "complete";
let printCalls = [];

function installBridge() {
  HTMLElement.prototype.appendChild = function appendChild(child) {
    const result = originalAppend.call(this, child);
    if (
      child &&
      child.nodeType === 1 &&
      child.getAttribute &&
      child.getAttribute("data-sale-receipt-print") === "a4"
    ) {
      const win = child.contentWindow;
      if (win) {
        win.focus = function focus() {};
        win.print = function print() {
          const doc = child.contentDocument;
          printCalls.push({
            frame: child,
            html: doc.documentElement.outerHTML,
            text: doc.body.textContent,
            compatMode: doc.compatMode,
          });
          if (printMode === "throw") {
            throw new Error("print-boom");
          }
          if (printMode === "complete") {
            win.dispatchEvent(new Event("afterprint"));
          }
        };
      }
    }
    return result;
  };
}

function renderDialog(currentSale, onClose = () => {}) {
  return render(
    <ThemeProvider theme={theme}>
      <div id="app-sentinel">APP-SENTINEL-NOT-IN-PRINT</div>
      <SaleReceiptDialog open onClose={onClose} sale={currentSale} />
    </ThemeProvider>
  );
}

function baseSale(overrides = {}) {
  return {
    id: 7,
    status: "completed",
    saleNumber: 12,
    paymentStatus: "paid",
    paymentMethod: "pix",
    totalAmount: "200",
    subtotalAmount: "180",
    discountAmount: "10",
    paidAmount: "150",
    completedAt: "2026-08-22T12:00:00.000Z",
    notes: "Obs <script>alert(1)</script>",
    paymentNotes: "Pago no balcão",
    contact: { name: "Cliente Silva" },
    seller: { name: "Vendedor Souza" },
    items: [
      {
        id: 21,
        productName: "Roteador XYZ",
        productSku: "SKU-1",
        quantity: 2,
        unit: "un",
        unitPrice: "100",
        discountAmount: "10",
        totalAmount: "190",
        identifiers: [{ position: 1, identifier: "SN-A123" }],
      },
    ],
    ...overrides,
  };
}

function releasePrintJobs() {
  window.dispatchEvent(new Event("afterprint"));
  document.querySelectorAll("[data-sale-receipt-print]").forEach((node) => {
    if (node.contentWindow) {
      node.contentWindow.dispatchEvent(new Event("afterprint"));
    }
  });
}

beforeEach(() => {
  changeLanguage("pt");
  useIsMobile.mockReturnValue(false);
  printMode = "complete";
  printCalls = [];
  toast.error.mockClear();
  installBridge();
  jest.spyOn(window, "print").mockImplementation(() => {
    throw new Error("parent-print");
  });
});

afterEach(() => {
  releasePrintJobs();
  HTMLElement.prototype.appendChild = originalAppend;
  if (window.print && window.print.mockRestore) {
    window.print.mockRestore();
  }
  document.querySelectorAll("[data-sale-receipt-print]").forEach((node) => {
    node.remove();
  });
});

describe("SaleReceiptDialog impressão isolada A4", () => {
  it("o botão Imprimir abre documento isolado com CSS A4 e não usa window.print", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    const { getByRole } = renderDialog(baseSale());

    fireEvent.click(getByRole("button", { name: "Imprimir" }));

    await waitFor(() => expect(printCalls.length).toBe(1));

    expect(window.print).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    const { html, text } = printCalls[0];

    expect(html).toContain("@page");
    expect(html).toContain("size: A4 portrait");
    expect(printCalls[0].compatMode).toBe("CSS1Compat");
    expect(html).not.toMatch(/80mm|58mm/);
    expect(text).toContain("Cliente Silva");
    expect(text).toContain("Vendedor Souza");
    expect(text).toContain("Roteador XYZ");
    expect(text).toContain("SKU-1");
    expect(text).toContain("SN-A123");
    expect(text).toContain("un");
    expect(text).toContain(formatCurrencyBRL("190"));
    expect(text).toContain(formatCurrencyBRL("200"));
    expect(text).toContain(formatCurrencyBRL("50"));
    expect(text).toContain("Obs <script>alert(1)</script>");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain("APP-SENTINEL-NOT-IN-PRINT");
    expect(html).toContain("sale-receipt-items-desktop");
    expect(html).toContain("sale-receipt-print-page");

    await waitFor(() => {
      expect(document.querySelector("[data-sale-receipt-print]")).toBeNull();
    });

    fetchSpy.mockRestore();
  });

  it("imprime venda cancelada com motivo, sem alterar o modal", async () => {
    const onClose = jest.fn();
    const { getByRole, getByText } = renderDialog(
      baseSale({
        status: "cancelled",
        paymentStatus: "unpaid",
        paidAmount: "0",
        cancelReason: "Cliente desistiu",
      }),
      onClose
    );

    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    const text = printCalls[0].text;
    expect(text).toContain("VENDA CANCELADA");
    expect(text).toContain("Cliente desistiu");
    expect(getByText("Cliente Silva")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.print).not.toHaveBeenCalled();
  });

  it("mantém a tabela no papel mesmo com a tela em layout mobile", async () => {
    useIsMobile.mockReturnValue(true);
    const { getByRole } = renderDialog(baseSale());
    expect(document.querySelector(".sale-receipt-items-mobile")).not.toBeNull();

    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    const { html } = printCalls[0];
    expect(html).toContain("sale-receipt-items-desktop");
    expect(html).not.toContain("sale-receipt-items-mobile");
  });

  it("não fecha o modal quando a impressão falha e mostra toast", async () => {
    printMode = "throw";
    const onClose = jest.fn();
    const { getByRole, getByText } = renderDialog(baseSale(), onClose);

    fireEvent.click(getByRole("button", { name: "Imprimir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(getByText("Cliente Silva")).toBeTruthy();
    expect(getByRole("button", { name: "Imprimir" })).toBeTruthy();
    expect(document.querySelector("[data-sale-receipt-print]")).toBeNull();
    expect(window.print).not.toHaveBeenCalled();
  });

  it("não fecha o modal quando o iframe não pode ser criado", async () => {
    const onClose = jest.fn();
    const { getByRole, getByText } = renderDialog(baseSale(), onClose);

    HTMLElement.prototype.appendChild = function appendChild(child) {
      if (
        child &&
        child.getAttribute &&
        child.getAttribute("data-sale-receipt-print") === "a4"
      ) {
        throw new Error("iframe-blocked");
      }
      return originalAppend.call(this, child);
    };

    fireEvent.click(getByRole("button", { name: "Imprimir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(getByText("Cliente Silva")).toBeTruthy();
    expect(printCalls.length).toBe(0);
    expect(window.print).not.toHaveBeenCalled();
  });

  it("ignora clique duplo e remove o iframe só depois do afterprint", async () => {
    printMode = "hold";
    const { getByRole } = renderDialog(baseSale());
    const button = getByRole("button", { name: "Imprimir" });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(document.querySelectorAll("[data-sale-receipt-print]")).toHaveLength(1);
    expect(window.print).not.toHaveBeenCalled();

    printCalls[0].frame.contentWindow.dispatchEvent(new Event("afterprint"));

    await waitFor(() => {
      expect(document.querySelector("[data-sale-receipt-print]")).toBeNull();
    });
  });

  it("reutiliza o trabalho em andamento sem misturar outra venda", async () => {
    printMode = "hold";
    const first = printSaleReceipt(baseSale());
    const second = printSaleReceipt(
      baseSale({ contact: { name: "Outro Cliente" } })
    );

    expect(second).toBe(first);
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(printCalls[0].text).toContain("Cliente Silva");
    expect(printCalls[0].text).not.toContain("Outro Cliente");
    expect(document.querySelectorAll("[data-sale-receipt-print]")).toHaveLength(1);

    printCalls[0].frame.contentWindow.dispatchEvent(new Event("afterprint"));
    await first;
    expect(document.querySelector("[data-sale-receipt-print]")).toBeNull();
  });

  it("o botão Cancelar fecha o recibo sem imprimir", () => {
    const onClose = jest.fn();
    const { getByRole } = renderDialog(baseSale(), onClose);

    fireEvent.click(getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(printCalls.length).toBe(0);
    expect(window.print).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("espera o css da fonte antes de consultar document.fonts", async () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    let fontsRead = false;
    const doc = {
      fonts: {
        get ready() {
          fontsRead = true;
          return Promise.resolve();
        },
      },
      querySelectorAll(selector) {
        if (selector === "img") return [];
        if (String(selector).includes("stylesheet")) return [link];
        return [];
      },
    };

    const pending = waitForPrintResources(doc, 500);
    await Promise.resolve();
    expect(fontsRead).toBe(false);
    link.dispatchEvent(new Event("load"));
    await pending;
    expect(fontsRead).toBe(true);
  });

  it("espera imagem futura sem travar se ela falhar", async () => {
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { configurable: true, get: () => false });
    let settled = false;
    const pending = waitForPrintResources(
      { querySelectorAll: () => [img], fonts: { ready: new Promise(() => {}) } },
      40
    ).then(() => {
      settled = true;
    });

    img.dispatchEvent(new Event("error"));
    await pending;
    expect(settled).toBe(true);
  });
});
