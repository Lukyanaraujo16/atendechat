/**
 * @jest-environment jsdom
 */
import { resolvePaymentSummaryDisplay } from "../paymentSummaryDisplay";

describe("resolvePaymentSummaryDisplay", () => {
  it("usa sale.totalAmount como autoridade quando summary está stale", () => {
    const display = resolvePaymentSummaryDisplay(
      { totalAmount: 29.6 },
      {
        totalAmount: 29.9,
        effectivePaid: 0,
        pendingAmount: 0,
        remainingToAllocate: 29.9,
      }
    );
    expect(display.totalAmount).toBe(29.6);
    expect(display.remainingToAllocate).toBe(29.6);
    expect(display.effectivePaid).toBe(0);
    expect(display.pendingAmount).toBe(0);
  });

  it("sem summary: falta distribuir = total da venda", () => {
    const display = resolvePaymentSummaryDisplay({ totalAmount: 29.6 }, null);
    expect(display).toEqual({
      totalAmount: 29.6,
      effectivePaid: 0,
      pendingAmount: 0,
      remainingToAllocate: 29.6,
    });
  });

  it("com pagamentos: remaining acompanha sale.totalAmount", () => {
    const display = resolvePaymentSummaryDisplay(
      { totalAmount: 29.6 },
      {
        totalAmount: 29.9,
        effectivePaid: 10,
        pendingAmount: 5,
        remainingToAllocate: 14.9,
      }
    );
    expect(display.totalAmount).toBe(29.6);
    expect(display.remainingToAllocate).toBe(14.6);
  });
});
