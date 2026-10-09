/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import {
  buildReceivablePaymentReceiptHtml,
  printReceivablePaymentReceipt,
} from "../printReceivablePaymentReceipt";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  SALE_RECEIPT_PRINT_FORMATS,
} from "../saleReceiptPrintFormats";

jest.mock("../../../services/inventoryApi", () => ({
  getInventoryReceiptBranding: jest.fn().mockResolvedValue({
    data: {
      receiptTradeName: "Loja Teste",
      receiptLegalName: "Loja Teste LTDA",
      receiptDocument: "12.345.678/0001-90",
      receiptPhone: "(27) 99999-9999",
      receiptFooterMessage: "Obrigado",
      receiptPrintFormat: "thermal80",
    },
  }),
}));

describe("printReceivablePaymentReceipt", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  it("HTML: branding + valor recebido + sem produtos + formato", () => {
    const html = buildReceivablePaymentReceiptHtml({
      customerName: "Maria",
      customerDocument: "52998224725",
      amount: 200,
      paymentMethod: "pix",
      paidAt: "2026-10-08T12:00:00.000Z",
      remainingOpenAmount: 300,
      previousOpenAmount: 500,
      saleNumber: 15,
      operatorName: "Ana",
      paymentId: 88,
      format: SALE_RECEIPT_PRINT_FORMATS.thermal80,
      branding: {
        tradeName: "Loja Teste",
        legalName: "Loja Teste LTDA",
        document: "12.345.678/0001-90",
        phone: "(27) 99999-9999",
        address: "Rua X",
        footerMessage: "Obrigado",
        logoUrl: "",
      },
      allocations: [
        {
          saleNumber: 15,
          sequence: 1,
          dueDate: "2026-10-01",
          amount: 200,
          openAmountAfter: 300,
        },
      ],
    });

    expect(html).toContain('data-testid="receivable-receipt-amount"');
    expect(html).toContain("Valor recebido");
    expect(html).toMatch(/R\$\s*200/);
    expect(html).toContain('data-testid="receivable-receipt-remaining"');
    expect(html).toContain("Saldo restante");
    expect(html).toContain("Saldo anterior");
    expect(html).toContain("Loja Teste");
    expect(html).toContain("Obrigado");
    expect(html).toContain("Comprovante de recebimento");
    expect(html).toContain('data-print-format="thermal80"');
    expect(html).toContain("sale-receipt-thermal");
    expect(html).not.toMatch(/\bSKU\b/i);
    expect(html).toContain("Parcela 1");
    expect(html).toContain("Maria");
    expect(html).toContain("Ana");
  });

  it("HTML A4 usa página A4 sem layout térmico", () => {
    const html = buildReceivablePaymentReceiptHtml({
      customerName: "Maria",
      amount: 10,
      paymentMethod: "pix",
      format: DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
      branding: { tradeName: "X", footerMessage: "", logoUrl: "" },
    });
    expect(html).toContain('data-print-format="a4"');
    expect(html).toContain("sale-receipt-print-page");
    expect(html).not.toContain("sale-receipt-thermal");
  });

  it("fluxo sem aba branca: iframe oculto + print (não window.open vazio)", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const appended = [];
    const originalAppend = document.body.appendChild.bind(document.body);
    jest.spyOn(document.body, "appendChild").mockImplementation((node) => {
      appended.push(node);
      return originalAppend(node);
    });

    // contentDocument mínimo para o pipeline
    const mockDoc = document.implementation.createHTMLDocument("print");
    const mockWin = {
      focus: jest.fn(),
      print: jest.fn(),
      addEventListener: jest.fn((ev, cb) => {
        if (ev === "afterprint") setTimeout(cb, 0);
      }),
      removeEventListener: jest.fn(),
    };
    Object.defineProperty(HTMLIFrameElement.prototype, "contentDocument", {
      configurable: true,
      get() {
        return mockDoc;
      },
    });
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      configurable: true,
      get() {
        return mockWin;
      },
    });

    await printReceivablePaymentReceipt({
      customerName: "Maria",
      amount: 10,
      paymentMethod: "pix",
      format: SALE_RECEIPT_PRINT_FORMATS.thermal80,
      branding: {
        tradeName: "Loja",
        legalName: "",
        document: "",
        phone: "",
        address: "",
        footerMessage: "",
        logoUrl: "",
      },
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(
      appended.some(
        (n) =>
          n.tagName === "IFRAME" &&
          n.getAttribute("data-receivable-receipt-print") === "thermal80"
      )
    ).toBe(true);
    expect(mockWin.print).toHaveBeenCalled();
    expect(mockDoc.body.innerHTML).toContain("receivable-receipt-amount");
    expect(mockDoc.head.innerHTML).toContain("80mm");

    openSpy.mockRestore();
    document.body.appendChild.mockRestore();
  });
});
