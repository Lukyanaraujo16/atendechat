/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import { printReceivablePaymentReceipt } from "../printReceivablePaymentReceipt";

describe("printReceivablePaymentReceipt", () => {
  let openSpy;
  let createObjectURLSpy;
  let revokeObjectURLSpy;
  let lastBlob;
  let lastUrl;

  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    lastBlob = null;
    lastUrl = "blob:mock-receivable-receipt";
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => lastUrl;
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }
    createObjectURLSpy = jest
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => {
        lastBlob = blob;
        return lastUrl;
      });
    revokeObjectURLSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  async function blobText() {
    if (typeof lastBlob.text === "function") return lastBlob.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(lastBlob);
    });
  }

  it("M1: usa valor recebido da operação, não saldo residual como principal", async () => {
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

    const written = await blobText();
    expect(written).toContain('data-testid="receivable-receipt-amount"');
    expect(written).toContain("Valor recebido nesta operação");
    expect(written).toMatch(/R\$\s*200/);
    expect(written).toContain('data-testid="receivable-receipt-remaining"');
    expect(written).toContain("Saldo em aberto do título");
    expect(written).toMatch(/R\$\s*300/);
    expect(written).toContain("Valor alocado");
  });

  it("ACHADO 1: abre via Blob URL (não document.write em aba noopener vazia)", async () => {
    printReceivablePaymentReceipt({
      customerName: "Maria",
      amount: 10,
      paymentMethod: "pix",
    });

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      lastUrl,
      "_blank",
      expect.stringContaining("noopener")
    );
    // open("", …) + write era a causa da aba branca
    expect(openSpy.mock.calls[0][0]).not.toBe("");
    const written = await blobText();
    expect(written).toContain("Comprovante de recebimento");
  });
});
