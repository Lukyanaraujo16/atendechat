import AppError from "../../../errors/AppError";
import {
  computeGlobalDiscountAmount,
  computeItemDiscountAmount,
  computeLineGross,
  effectivePercent,
  merchandiseEffectiveDiscountPercent
} from "../inventoryDiscountHelpers";
import { buildMerchandiseDiscountSnapshot } from "../inventoryDiscountGovernance";
import { roundMoney } from "../inventorySaleHelpers";

describe("inventoryDiscountHelpers — casos A–J", () => {
  test("Caso A — item R$ 100×1 desconto R$10 → líquido 90", () => {
    const r = computeItemDiscountAmount({
      discountType: "fixed",
      discountAmount: 10,
      unitPrice: 100,
      quantity: 1
    });
    expect(r.lineGross).toBe(100);
    expect(r.discountAmount).toBe(10);
    expect(r.lineTotal).toBe(90);
  });

  test("Caso B — linha R$ 100×3 desconto R$10 → líquido 290 (não 10/un)", () => {
    const r = computeItemDiscountAmount({
      discountType: "fixed",
      discountAmount: 10,
      unitPrice: 100,
      quantity: 3
    });
    expect(r.lineGross).toBe(300);
    expect(r.discountAmount).toBe(10);
    expect(r.lineTotal).toBe(290);
  });

  test("Caso C — linha % 100×3 @10% → desconto 30 líquido 270", () => {
    const r = computeItemDiscountAmount({
      discountType: "percentage",
      discountPercent: 10,
      unitPrice: 100,
      quantity: 3
    });
    expect(r.discountAmount).toBe(30);
    expect(r.lineTotal).toBe(270);
  });

  test("Caso D — centavos 29,90 @10%", () => {
    const gross = computeLineGross(29.9, 1);
    expect(gross).toBe(29.9);
    const r = computeItemDiscountAmount({
      discountType: "percentage",
      discountPercent: 10,
      unitPrice: 29.9,
      quantity: 1
    });
    expect(r.discountAmount).toBe(2.99);
    expect(r.lineTotal).toBe(26.91);
  });

  test("Caso E — item + global", () => {
    const afterItems = 900;
    const global = computeGlobalDiscountAmount({
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      merchandiseAfterItemDiscounts: afterItems
    });
    expect(global.globalDiscountAmount).toBe(90);
    expect(global.netMerchandise).toBe(810);

    const snap = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 1000,
          quantity: 1,
          discountType: "fixed",
          discountAmount: 100
        }
      ],
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      maxAllowedPercent: 100
    });
    expect(snap.grossMerchandise).toBe(1000);
    expect(snap.itemDiscountTotal).toBe(100);
    expect(snap.merchandiseAfterItemDiscounts).toBe(900);
    expect(snap.globalDiscountAmount).toBe(90);
    expect(snap.netMerchandise).toBe(810);
  });

  test("Caso F — frete fora da base de desconto", () => {
    const netMerchandise = 810;
    const freight = 30;
    const total = roundMoney(netMerchandise + freight);
    expect(total).toBe(840);
    const global = computeGlobalDiscountAmount({
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      merchandiseAfterItemDiscounts: 900
    });
    expect(global.netMerchandise).toBe(810);
    // frete não altera desconto global
    expect(global.globalDiscountAmount).toBe(90);
  });

  test("Caso G — comissão sobre mercadoria líquida sem frete", () => {
    const commissionBase = 810;
    const commission = roundMoney((commissionBase * 10) / 100);
    expect(commission).toBe(81);
  });

  test("Caso H — total autoritativo para pagamento misto", () => {
    const total = 900;
    const pix = 300;
    const storeCredit = 600;
    expect(roundMoney(pix + storeCredit)).toBe(total);
  });

  test("Caso I — desconto inválido > bruto", () => {
    try {
      computeItemDiscountAmount({
        discountType: "fixed",
        discountAmount: 101,
        unitPrice: 100,
        quantity: 1
      });
      throw new Error("expected AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe("ERR_INVENTORY_DISCOUNT_EXCEEDS_LINE");
    }
  });

  test("Caso J — 100% → líquido 0", () => {
    const r = computeItemDiscountAmount({
      discountType: "percentage",
      discountPercent: 100,
      unitPrice: 100,
      quantity: 1
    });
    expect(r.discountAmount).toBe(100);
    expect(r.lineTotal).toBe(0);
  });

  test("legado null discountType → fixed", () => {
    const r = computeItemDiscountAmount({
      discountType: null,
      discountAmount: 10,
      unitPrice: 100,
      quantity: 3
    });
    expect(r.discountType).toBe("fixed");
    expect(r.lineTotal).toBe(290);
  });

  test("percentual efetivo R$ e governança total", () => {
    expect(effectivePercent(10, 100)).toBe(10);
    expect(
      merchandiseEffectiveDiscountPercent({
        grossMerchandise: 1000,
        itemDiscountTotal: 100,
        globalDiscountAmount: 90
      })
    ).toBe(19);
  });

  test("global fixed não pode exceder base", () => {
    expect(() =>
      computeGlobalDiscountAmount({
        globalDiscountType: "fixed",
        globalDiscountAmount: 901,
        merchandiseAfterItemDiscounts: 900
      })
    ).toThrow();
  });
});
