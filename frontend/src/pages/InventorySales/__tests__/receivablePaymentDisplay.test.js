/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import { formatReceivablePaymentHistoryLine } from "../receivablePaymentDisplay";

describe("formatReceivablePaymentHistoryLine", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  it("rótula recebimento, estornado e estorno sem confusão de sinal", () => {
    expect(
      formatReceivablePaymentHistoryLine({
        paymentMethod: "pix",
        amount: 10,
        notes: "teste",
      }, { includeNotes: true })
    ).toMatch(/^Recebimento — PIX — R\$\s*10/);

    expect(
      formatReceivablePaymentHistoryLine({
        paymentMethod: "pix",
        amount: 10,
        reversedAt: "2026-10-08T12:00:00.000Z",
        notes: "teste",
      }, { includeNotes: true })
    ).toContain("Estornado");

    const reversal = formatReceivablePaymentHistoryLine({
      paymentMethod: "pix",
      amount: -10,
      reverseOfPaymentId: 1,
      notes: "teste",
    }, { includeNotes: true });
    expect(reversal).toMatch(/^Estorno — PIX — R\$\s*10/);
    expect(reversal).not.toContain("-R$");
  });
});
