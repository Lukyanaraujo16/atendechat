import AppError from "../../../errors/AppError";
import { calculateSalePaymentAggregate } from "../inventorySalePaymentAggregate";

describe("calculateSalePaymentAggregate", () => {
  it("sem payments → unpaid / paid 0 / remaining = total", () => {
    expect(calculateSalePaymentAggregate(100, [])).toEqual({
      effectivePaid: 0,
      paymentStatus: "unpaid",
      pendingAmount: 100
    });
  });

  it("pending não soma como recebido", () => {
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 100, status: "pending" }
      ])
    ).toEqual({
      effectivePaid: 0,
      paymentStatus: "unpaid",
      pendingAmount: 100
    });
  });

  it("paid parcial", () => {
    expect(
      calculateSalePaymentAggregate(100, [{ amount: 40, status: "paid" }])
    ).toEqual({
      effectivePaid: 40,
      paymentStatus: "partial",
      pendingAmount: 60
    });
  });

  it("dois paid somam até paid", () => {
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 40, status: "paid" },
        { amount: 60, status: "paid" }
      ])
    ).toEqual({
      effectivePaid: 100,
      paymentStatus: "paid",
      pendingAmount: 0
    });
  });

  it("paid + pending → partial; pending não entra no paid", () => {
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 40, status: "paid" },
        { amount: 60, status: "pending" }
      ])
    ).toEqual({
      effectivePaid: 40,
      paymentStatus: "partial",
      pendingAmount: 60
    });
  });

  it("reversed não soma (linha inativa; estorno operacional é fase futura)", () => {
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 100, status: "paid" },
        { amount: 20, status: "reversed" }
      ])
    ).toEqual({
      effectivePaid: 100,
      paymentStatus: "paid",
      pendingAmount: 0
    });
  });

  it("overpayment → erro", () => {
    expect(() =>
      calculateSalePaymentAggregate(100, [{ amount: 101, status: "paid" }])
    ).toThrow(AppError);
  });

  it("centavos 33.33+33.33+33.34 = 100.00", () => {
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 33.33, status: "paid" },
        { amount: 33.33, status: "paid" },
        { amount: 33.34, status: "paid" }
      ])
    ).toEqual({
      effectivePaid: 100,
      paymentStatus: "paid",
      pendingAmount: 0
    });
  });
});
