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
import { SALE_RECEIPT_PRINT_FORMATS } from "../saleReceiptPrintFormats";

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const mockGetInventoryReceiptBranding = jest.fn(() => Promise.resolve({ data: {} }));

jest.mock("../../../services/inventoryApi", () => ({
  getInventoryReceiptBranding: (...args) => mockGetInventoryReceiptBranding(...args),
}));

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MutationObserverMock;

const PRINT_FORMAT_IDS = new Set(Object.values(SALE_RECEIPT_PRINT_FORMATS));
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
      PRINT_FORMAT_IDS.has(child.getAttribute("data-sale-receipt-print"))
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
  mockGetInventoryReceiptBranding.mockReset();
  mockGetInventoryReceiptBranding.mockResolvedValue({ data: {} });
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
    expect(html).not.toContain("sale-receipt-thermal");
    expect(printCalls[0].frame.getAttribute("data-sale-receipt-print")).toBe("a4");
    expect(printCalls[0].frame.style.width).toBe("210mm");

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

function assertThermalReceipt(printed, { formatId, pageSize, frameWidth, productName = "Roteador XYZ" }) {
  const { html, text, frame } = printed;
  expect(frame.getAttribute("data-sale-receipt-print")).toBe(formatId);
  expect(frame.style.width).toBe(frameWidth);
  const cssMatch = html.match(
    /<style data-sale-receipt-print-css="[^"]+">([\s\S]*?)<\/style>/
  );
  const printCss = cssMatch ? cssMatch[1] : "";
  expect(printCss).toContain(`size: ${pageSize}`);
  expect(printCss).toContain("margin: 0");
  expect(printCss).not.toMatch(/size:\s*\d+mm auto/);
  expect(printCss).not.toContain("A4 portrait");
  expect(printCss).not.toContain("297mm");
  expect(printCss).not.toMatch(/transform\s*:|scale\s*\(|zoom\s*:/);
  expect(html).not.toContain("<table");
  expect(html).not.toContain("sale-receipt-items-desktop");
  expect(html).toContain("sale-receipt-thermal");
  expect(html).toContain("overflow-wrap: anywhere");
  expect(text).toContain("Cliente Silva");
  expect(text).toContain("Vendedor Souza");
  expect(text).toContain(productName);
  expect(text).toContain("SKU-1");
  expect(text).toContain("SN-A123");
  expect(text).toContain("un");
  expect(text).toContain("PIX");
  expect(text).toContain("Concluída");
  expect(text).toContain("Pago");
  expect(text).toContain(formatCurrencyBRL("100"));
  expect(text).toContain(formatCurrencyBRL("190"));
  expect(text).toContain(formatCurrencyBRL("180"));
  expect(text).toContain(formatCurrencyBRL("10"));
  expect(text).toContain(formatCurrencyBRL("200"));
  expect(text).toContain(formatCurrencyBRL("150"));
  expect(text).toContain(formatCurrencyBRL("50"));
  expect(text).toContain("Obs <script>alert(1)</script>");
  expect(text).toContain("Pago no balcão");
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<img[\s>]/i);
  expect(html).not.toContain("APP-SENTINEL-NOT-IN-PRINT");
}

describe("SaleReceiptDialog formatos térmicos", () => {
  it("80 mm usa lista térmica no mesmo pipeline, sem tabela A4", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    const { getByRole } = renderDialog(baseSale());

    expect(document.querySelector(".sale-receipt-items-desktop")).not.toBeNull();
    fireEvent.click(getByRole("button", { name: "80 mm" }));
    expect(document.querySelector(".sale-receipt-thermal")).toBeNull();
    expect(document.querySelector(".sale-receipt-items-desktop")).not.toBeNull();

    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    expect(window.print).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    assertThermalReceipt(printCalls[0], {
      formatId: "thermal80",
      pageSize: "72mm 100mm",
      frameWidth: "72mm",
    });
    fetchSpy.mockRestore();
  });

  it("58 mm quebra nome longo e não usa a altura A4", async () => {
    useIsMobile.mockReturnValue(false);
    const longName = "Capinha transparente extra grande para aparelho com nome muito longo";
    const { getByRole } = renderDialog(
      baseSale({
        items: [
          {
            ...baseSale().items[0],
            productName: longName,
          },
        ],
      })
    );

    fireEvent.click(getByRole("button", { name: "58 mm" }));
    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    assertThermalReceipt(printCalls[0], {
      formatId: "thermal58",
      pageSize: "48mm 100mm",
      frameWidth: "48mm",
      productName: longName,
    });
    expect(printCalls[0].text).toContain(longName);
    expect(window.print).not.toHaveBeenCalled();
  });

  it("térmica 80 imprime venda cancelada em texto", async () => {
    const { getByRole, getByText } = renderDialog(
      baseSale({
        status: "cancelled",
        paymentStatus: "unpaid",
        paidAmount: "0",
        cancelReason: "Cliente desistiu <img src=x onerror=alert(1)>",
      })
    );

    fireEvent.click(getByRole("button", { name: "80 mm" }));
    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    const { html, text } = printCalls[0];
    expect(text).toContain("VENDA CANCELADA");
    expect(text).toContain("Cancelada");
    expect(text).toContain("Cliente desistiu <img src=x onerror=alert(1)>");
    expect(html).not.toMatch(/<img[\s>]/i);
    expect(html).toContain("sale-receipt-thermal-cancelled");
    expect(getByText("Cliente Silva")).toBeTruthy();
  });

  it("não imprime linhas de cliente, vendedor ou pagamento quando faltam", async () => {
    const { getByRole } = renderDialog(
      baseSale({
        contact: null,
        seller: null,
        paymentMethod: null,
        notes: "",
        paymentNotes: "",
      })
    );

    fireEvent.click(getByRole("button", { name: "58 mm" }));
    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));

    const text = printCalls[0].text;
    expect(text).not.toContain("Sem cliente");
    expect(text).not.toContain("Sem vendedor");
    expect(text).not.toContain("Sem forma definida");
    expect(text).not.toContain("Cliente Silva");
    expect(text).toContain("Roteador XYZ");
    expect(text).toContain(formatCurrencyBRL("200"));
  });

  it("tela mobile com A4 continua A4 e tela desktop com 58 continua 58", async () => {
    useIsMobile.mockReturnValue(true);
    const mobile = renderDialog(baseSale());
    fireEvent.click(mobile.getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(printCalls[0].html).toContain("size: A4 portrait");
    expect(printCalls[0].html).toContain("sale-receipt-items-desktop");
    mobile.unmount();
    printCalls = [];

    useIsMobile.mockReturnValue(false);
    const desktop = renderDialog(baseSale());
    fireEvent.click(desktop.getByRole("button", { name: "58 mm" }));
    fireEvent.click(desktop.getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(printCalls[0].frame.style.width).toBe("48mm");
    expect(printCalls[0].html).toContain("sale-receipt-thermal");
    expect(printCalls[0].html).not.toContain("sale-receipt-items-desktop");
  });

  it("reabre o recibo em A4 e rejeita formato desconhecido", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <ThemeProvider theme={theme}>
          <button type="button" onClick={() => setOpen(false)}>
            fechar-recibo
          </button>
          <button type="button" onClick={() => setOpen(true)}>
            reabrir-recibo
          </button>
          <SaleReceiptDialog open={open} onClose={() => setOpen(false)} sale={baseSale()} />
        </ThemeProvider>
      );
    }

    const { getByRole } = render(<Harness />);
    fireEvent.click(getByRole("button", { name: "80 mm" }));
    fireEvent.click(getByRole("button", { name: "fechar-recibo", hidden: true }));
    fireEvent.click(getByRole("button", { name: "reabrir-recibo", hidden: true }));

    await waitFor(() => {
      expect(getByRole("button", { name: "A4" }).getAttribute("aria-pressed")).toBe("true");
    });

    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(printCalls[0].html).toContain("size: A4 portrait");
    expect(printCalls[0].html).not.toContain("sale-receipt-thermal");

    await expect(printSaleReceipt(baseSale(), "thermal")).rejects.toThrow(
      /print-format-invalid/
    );
    expect(document.querySelectorAll("[data-sale-receipt-print]")).toHaveLength(0);
  });

  it("desabilita a troca de formato enquanto a impressão está em andamento", async () => {
    printMode = "hold";
    const { getByRole } = renderDialog(baseSale());
    fireEvent.click(getByRole("button", { name: "80 mm" }));
    fireEvent.click(getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(getByRole("button", { name: "58 mm" }).disabled).toBe(true);
    expect(printCalls).toHaveLength(1);
    expect(printCalls[0].frame.style.width).toBe("72mm");
    printCalls[0].frame.contentWindow.dispatchEvent(new Event("afterprint"));
    await waitFor(() => {
      expect(document.querySelector("[data-sale-receipt-print]")).toBeNull();
    });
  });
});

const FULL_BRANDING = {
  receiptTradeName: "Loja ABC",
  receiptLegalName: "Loja ABC LTDA",
  receiptDocument: "12.345.678/0001-90",
  receiptPhone: "(27) 99999-9999",
  receiptAddress: "Rua X, 123\nCentro",
  receiptFooterMessage: "Obrigado pela preferência.\nVolte sempre.",
};

async function printCurrent(view, formatLabel) {
  if (formatLabel) {
    fireEvent.click(view.getByRole("button", { name: formatLabel }));
  }
  fireEvent.click(view.getByRole("button", { name: "Imprimir" }));
  await waitFor(() => expect(printCalls.length).toBe(1));
  return printCalls[0];
}

describe("SaleReceiptDialog branding textual", () => {
  it.each([
    ["A4", null],
    ["80 mm", "80 mm"],
    ["58 mm", "58 mm"],
  ])("%s sem branding não cria bloco vazio", async (_label, formatLabel) => {
    const view = renderDialog(baseSale());
    expect(view.queryByText("Documento:")).toBeNull();
    expect(view.queryByText("Loja ABC")).toBeNull();

    const printed = await printCurrent(view, formatLabel);
    expect(printed.text).toContain("Recibo de venda");
    expect(printed.text).not.toContain("Loja ABC");
    expect(printed.text).not.toContain("Documento:");
    expect(printed.text).not.toContain("Telefone:");
    expect(printed.html).not.toMatch(/class="[^"]*sale-receipt-branding/);
  });

  it.each([
    ["A4", null],
    ["80 mm", "80 mm"],
    ["58 mm", "58 mm"],
  ])("%s imprime o branding completo e escapa HTML", async (_label, formatLabel) => {
    mockGetInventoryReceiptBranding.mockResolvedValue({
      data: {
        ...FULL_BRANDING,
        receiptTradeName: "<script>alert(1)</script>",
        receiptAddress: "<img src=x onerror=alert(1)>\nLinha 2",
      },
    });
    const view = renderDialog(baseSale());
    await waitFor(() => expect(view.getByText("<script>alert(1)</script>")).toBeTruthy());

    const printed = await printCurrent(view, formatLabel);
    expect(printed.text).toContain("<script>alert(1)</script>");
    expect(printed.text).toContain("Loja ABC LTDA");
    expect(printed.text).toContain("Documento: 12.345.678/0001-90");
    expect(printed.text).toContain("Telefone: (27) 99999-9999");
    expect(printed.text).toContain("<img src=x onerror=alert(1)>");
    expect(printed.text).toContain("Linha 2");
    expect(printed.text).toContain("Obrigado pela preferência.");
    expect(printed.text).toContain("Volte sempre.");
    expect(printed.text.indexOf("<script>alert(1)</script>")).toBeLessThan(
      printed.text.indexOf("Recibo de venda")
    );
    expect(printed.text.indexOf("Volte sempre.")).toBeGreaterThan(
      printed.text.indexOf("Obs <script>alert(1)</script>")
    );
    expect(printed.html).not.toMatch(/<script/i);
    expect(printed.html).not.toMatch(/<img[\s>]/i);
    expect(printed.html).not.toContain("<br");
    expect(printed.html).toContain("white-space: pre-line");
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.querySelector("img")).toBeNull();
  });

  it("imprime só o nome fantasia, só o documento ou só o rodapé", async () => {
    mockGetInventoryReceiptBranding.mockResolvedValue({
      data: { receiptTradeName: "Somente Nome" },
    });
    const trade = renderDialog(baseSale());
    const tradePrint = await printCurrent(trade, null);
    expect(tradePrint.text).toContain("Somente Nome");
    expect(tradePrint.text).not.toContain("Documento:");
    expect(tradePrint.text).not.toContain("Telefone:");
    expect(tradePrint.html).not.toContain("sale-receipt-branding-footer");

    printCalls = [];
    mockGetInventoryReceiptBranding.mockResolvedValue({
      data: { receiptDocument: "ABC-9" },
    });
    const documentView = renderDialog(baseSale({ id: 8 }));
    const documentPrint = await printCurrent(documentView, "80 mm");
    expect(documentPrint.text).toContain("Documento: ABC-9");
    expect(documentPrint.text).not.toContain("Somente Nome");
    expect(documentPrint.text).not.toContain("Telefone:");

    printCalls = [];
    mockGetInventoryReceiptBranding.mockResolvedValue({
      data: { receiptFooterMessage: "Rodapé único" },
    });
    const footerView = renderDialog(baseSale({ id: 9 }));
    const footerPrint = await printCurrent(footerView, "58 mm");
    expect(footerPrint.text).toContain("Rodapé único");
    expect(footerPrint.text).not.toContain("Documento:");
    expect(footerPrint.html).toContain("sale-receipt-branding-footer");
    expect(footerPrint.html).not.toContain('class="sale-receipt-branding"');
  });

  it("busca o branding uma vez e imprime mesmo se a leitura falhar", async () => {
    const view = renderDialog(baseSale());
    await printCurrent(view, null);
    printCalls = [];
    fireEvent.click(view.getByRole("button", { name: "80 mm" }));
    fireEvent.click(view.getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printCalls.length).toBe(1));
    expect(mockGetInventoryReceiptBranding).toHaveBeenCalledTimes(1);

    printCalls = [];
    mockGetInventoryReceiptBranding.mockRejectedValue(new Error("branding-down"));
    const failed = renderDialog(baseSale({ id: 11 }));
    const printed = await printCurrent(failed, null);
    expect(printed.text).toContain("Recibo de venda");
    expect(printed.html).not.toMatch(/class="[^"]*sale-receipt-branding/);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
