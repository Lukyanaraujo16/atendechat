import {
  computeItemDiscountPreview,
  computeLineGross,
  computeSaleTotalsPreview,
  roundMoney,
} from "../saleDiscountPreview";

describe("saleDiscountPreview — casos A–F", () => {
  test("Caso A — item R$ 100×1 desconto R$10 → líquido 90", () => {
    const r = computeItemDiscountPreview({
      discountType: "fixed",
      discountAmount: 10,
      unitPrice: 100,
      quantity: 1,
    });
    expect(r.lineGross).toBe(100);
    expect(r.discountAmount).toBe(10);
    expect(r.lineTotal).toBe(90);
  });

  test("Caso B — linha R$ 100×3 desconto R$10 → líquido 290", () => {
    const r = computeItemDiscountPreview({
      discountType: "fixed",
      discountAmount: 10,
      unitPrice: 100,
      quantity: 3,
    });
    expect(r.lineGross).toBe(300);
    expect(r.discountAmount).toBe(10);
    expect(r.lineTotal).toBe(290);
  });

  test("Caso C — linha % 100×3 @10% → desconto 30 líquido 270", () => {
    const r = computeItemDiscountPreview({
      discountType: "percentage",
      discountPercent: 10,
      unitPrice: 100,
      quantity: 3,
    });
    expect(r.discountAmount).toBe(30);
    expect(r.lineTotal).toBe(270);
  });

  test("Caso D — centavos 29,90 @10%", () => {
    expect(computeLineGross(29.9, 1)).toBe(29.9);
    const r = computeItemDiscountPreview({
      discountType: "percentage",
      discountPercent: 10,
      unitPrice: 29.9,
      quantity: 1,
    });
    expect(r.discountAmount).toBe(2.99);
    expect(r.lineTotal).toBe(26.91);
  });

  test("Caso E — item + global na venda", () => {
    const sale = {
      subtotalAmount: 1000,
      discountAmount: 100,
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      globalDiscountAmount: 90,
      freightAmount: 0,
      totalAmount: 810,
    };
    const totals = computeSaleTotalsPreview(sale);
    expect(totals.grossSubtotal).toBe(1000);
    expect(totals.itemDiscountTotal).toBe(100);
    expect(totals.merchandiseAfterItems).toBe(900);
    expect(totals.globalDiscountAmount).toBe(90);
    expect(totals.netMerchandise).toBe(810);
    expect(totals.total).toBe(810);
  });

  test("Caso F — frete fora da base de desconto", () => {
    const sale = {
      subtotalAmount: 1000,
      discountAmount: 100,
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      globalDiscountAmount: 90,
      freightAmount: 30,
      totalAmount: 840,
    };
    const totals = computeSaleTotalsPreview(sale);
    expect(totals.globalDiscountAmount).toBe(90);
    expect(totals.freight).toBe(30);
    expect(totals.total).toBe(840);
    expect(roundMoney(totals.netMerchandise + totals.freight)).toBe(840);
  });
});
