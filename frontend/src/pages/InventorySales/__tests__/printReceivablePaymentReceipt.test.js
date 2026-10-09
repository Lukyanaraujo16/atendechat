/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import { printReceivablePaymentReceipt } from "../printReceivablePaymentReceipt";

describe("printReceivablePaymentReceipt", () => {
  let openSpy;
  let written = "";

  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    written = "";
    openSpy = jest.spyOn(window, "open").mockImplementation(() => {
      const doc = {
        open: jest.fn(),
        write: (html) => {
          written = html;
        },
        close: jest.fn(),
      };
      return { document: doc };
    });
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("M1: usa valor recebido da operação, não saldo residual como principal", () => {
    printReceivablePaymentReceipt({
      customerName: "Maria",
      customerDocument: "52998224725",
      amount: 200,
      paymentMethod: "pix",
      paidAt: "2026-10-08T12:00:00.000Z",
      remainingOpenAmount: 300,
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

    expect(written).toContain('data-testid="receivable-receipt-amount"');
    expect(written).toContain("Valor recebido nesta operação");
    expect(written).toMatch(/R\$\s*200/);
    expect(written).toContain('data-testid="receivable-receipt-remaining"');
    expect(written).toContain("Saldo em aberto do título");
    expect(written).toMatch(/R\$\s*300/);
    expect(written).toContain("Valor alocado");
  });
});
