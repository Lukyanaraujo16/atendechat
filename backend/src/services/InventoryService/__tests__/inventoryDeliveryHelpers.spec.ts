import AppError from "../../../errors/AppError";
import {
  assertAddressRequiredWhenNeeded,
  assertPickupInvariants,
  computeCommissionExcludingFreight,
  merchandiseTotalAfterDiscounts,
  normalizeSaleDeliveryAddress,
  parseNonNegativeMoney,
  resolveFreightAmount
} from "../inventoryDeliveryHelpers";
import { settlePaymentOnComplete } from "../inventoryPaymentHelpers";

describe("inventoryDeliveryHelpers", () => {
  describe("parseNonNegativeMoney", () => {
    it("aceita e arredonda valores válidos", () => {
      expect(parseNonNegativeMoney(15)).toBe(15);
      expect(parseNonNegativeMoney("15.555")).toBe(15.56);
      expect(parseNonNegativeMoney(0)).toBe(0);
    });

    it("rejeita negativo, NaN e texto inválido", () => {
      expect(() => parseNonNegativeMoney(-1)).toThrow(AppError);
      expect(() => parseNonNegativeMoney("abc")).toThrow(AppError);
      expect(() => parseNonNegativeMoney(Number.POSITIVE_INFINITY)).toThrow(
        AppError
      );
    });
  });

  describe("resolveFreightAmount", () => {
    it("pickup força zero independente do payload", () => {
      expect(
        resolveFreightAmount({
          method: {
            kind: "pickup",
            defaultAmount: 0,
            allowAmountOverride: false
          },
          requestedFreightAmount: 99
        })
      ).toBe(0);
    });

    it("override proibido usa defaultAmount", () => {
      expect(
        resolveFreightAmount({
          method: {
            kind: "courier",
            defaultAmount: 15,
            allowAmountOverride: false
          },
          requestedFreightAmount: 1
        })
      ).toBe(15);
    });

    it("override permitido usa valor custom ou default", () => {
      expect(
        resolveFreightAmount({
          method: {
            kind: "courier",
            defaultAmount: 15,
            allowAmountOverride: true
          },
          requestedFreightAmount: 22
        })
      ).toBe(22);
      expect(
        resolveFreightAmount({
          method: {
            kind: "carrier",
            defaultAmount: 35,
            allowAmountOverride: true
          }
        })
      ).toBe(35);
    });
  });

  describe("assertPickupInvariants", () => {
    it("rejeita pickup incoerente", () => {
      expect(() =>
        assertPickupInvariants({
          kind: "pickup",
          defaultAmount: 10,
          allowAmountOverride: false,
          requiresAddress: false
        })
      ).toThrow(AppError);
      expect(() =>
        assertPickupInvariants({
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: true,
          requiresAddress: false
        })
      ).toThrow(AppError);
      expect(() =>
        assertPickupInvariants({
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: true
        })
      ).toThrow(AppError);
    });

    it("aceita pickup coerente", () => {
      expect(() =>
        assertPickupInvariants({
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: false
        })
      ).not.toThrow();
    });
  });

  describe("endereço", () => {
    const full = {
      recipientName: "Ana",
      recipientPhone: "11999999999",
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "sp",
      postalCode: "",
      complement: "  ",
      notes: null
    };

    it("normaliza e exige campos obrigatórios quando requiresAddress", () => {
      const normalized = normalizeSaleDeliveryAddress(full);
      expect(normalized.state).toBe("SP");
      expect(normalized.postalCode).toBeNull();
      expect(normalized.complement).toBeNull();
      expect(() =>
        assertAddressRequiredWhenNeeded(true, normalized)
      ).not.toThrow();
      expect(() =>
        assertAddressRequiredWhenNeeded(true, {
          ...normalized,
          street: null
        })
      ).toThrow(AppError);
    });

    it("pickup/não exige endereço não valida campos", () => {
      expect(() =>
        assertAddressRequiredWhenNeeded(
          false,
          normalizeSaleDeliveryAddress({})
        )
      ).not.toThrow();
    });
  });

  describe("comissão e pagamento com frete", () => {
    it("comissão exclui frete; freight=0 preserva histórico", () => {
      expect(
        computeCommissionExcludingFreight({
          totalAmount: 230,
          freightAmount: 30,
          commissionRate: 10
        })
      ).toBe(20);
      expect(
        computeCommissionExcludingFreight({
          totalAmount: 200,
          freightAmount: 0,
          commissionRate: 10
        })
      ).toBe(20);
      expect(
        merchandiseTotalAfterDiscounts({
          totalAmount: 110,
          freightAmount: 20
        })
      ).toBe(90);
    });

    it("PIX/registerAsPaid e cartão usam total com frete; boleto unpaid=0", () => {
      const total = 120;
      const pix = settlePaymentOnComplete({
        paymentMethod: "pix",
        cardInstallmentCount: null,
        totalAmount: total,
        paidAmount: 0,
        existingPaidAt: null,
        registerAsPaid: true,
        canManagePayments: true
      });
      expect(pix.paidAmount).toBe(120);

      const card = settlePaymentOnComplete({
        paymentMethod: "credit_card",
        cardInstallmentCount: 3,
        totalAmount: total,
        paidAmount: 0,
        existingPaidAt: null
      });
      expect(card.paidAmount).toBe(120);

      const boleto = settlePaymentOnComplete({
        paymentMethod: "boleto",
        cardInstallmentCount: null,
        totalAmount: total,
        paidAmount: 0,
        existingPaidAt: null,
        canManagePayments: true
      });
      expect(boleto.paidAmount).toBe(0);
      expect(boleto.paymentStatus).toBe("unpaid");
    });
  });
});
