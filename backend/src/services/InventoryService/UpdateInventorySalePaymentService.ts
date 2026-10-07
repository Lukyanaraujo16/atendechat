import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import {
  assertSaleAllowsPaymentUpdate,
  parseOptionalPaymentMethod,
  parsePaidAmount,
  parsePaymentStatus,
  resolveCardInstallmentCount,
  resolvePaidAtForPaymentUpdate,
  validatePaymentConsistency
} from "./inventoryPaymentHelpers";
import {
  applyLegacyAbsolutePayment,
  syncDraftPaymentIntention
} from "./inventorySalePaymentEngine";
import {
  findInventorySaleOrThrow,
  buildInventorySaleIncludes,
  toMoney
} from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type PaymentBody = {
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  cardInstallmentCount?: unknown;
  paidAmount?: unknown;
  paidAt?: unknown;
  paymentNotes?: unknown;
};

export default async function UpdateInventorySalePaymentService(input: {
  companyId: number;
  saleId: number;
  body: PaymentBody;
  actorUserId?: number | null;
}): Promise<InventorySale> {
  const saleId = await sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );

    if (input.body.paymentStatus === undefined || input.body.paymentStatus === null) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "paymentStatus é obrigatório."
      );
    }

    const paymentStatus = parsePaymentStatus(input.body.paymentStatus);
    assertSaleAllowsPaymentUpdate({
      saleStatus: sale.status,
      paymentStatus
    });

    const methodProvided = input.body.paymentMethod !== undefined;
    const countProvided = Object.prototype.hasOwnProperty.call(
      input.body,
      "cardInstallmentCount"
    );

    let nextMethod = sale.paymentMethod;
    if (methodProvided) {
      nextMethod = parseOptionalPaymentMethod(input.body.paymentMethod);
    }

    let nextInstallments = sale.cardInstallmentCount;
    if (methodProvided || countProvided) {
      nextInstallments = resolveCardInstallmentCount({
        paymentMethod: nextMethod,
        raw: input.body.cardInstallmentCount,
        rawProvided: countProvided,
        existing: sale.cardInstallmentCount,
        preserveHistoricalNull:
          !countProvided && sale.paymentMethod === "credit_card"
      });
    }

    const nextNotes =
      input.body.paymentNotes !== undefined
        ? normalizeOptionalString(input.body.paymentNotes)
        : sale.paymentNotes ?? null;

    const actorUserId = input.actorUserId ?? null;

    if (sale.status === "draft") {
      if (
        input.body.paidAmount !== undefined &&
        input.body.paidAmount !== null &&
        parsePaidAmount(input.body.paidAmount) > 0
      ) {
        throw new AppError(
          "ERR_INVENTORY_SALE_PAYMENT_DRAFT_AMOUNT",
          400,
          "Venda em rascunho não pode ter valor pago."
        );
      }
      if (
        input.body.paidAt !== undefined &&
        input.body.paidAt !== null &&
        input.body.paidAt !== ""
      ) {
        throw new AppError(
          "ERR_INVENTORY_SALE_PAYMENT_DRAFT_PAID_AT",
          400,
          "Venda em rascunho não pode ter data de pagamento."
        );
      }

      const cache = await syncDraftPaymentIntention(
        sale,
        {
          paymentMethod: nextMethod,
          cardInstallmentCount: nextInstallments,
          paymentNotes: nextNotes,
          actorUserId
        },
        t
      );

      await sale.update(
        {
          paymentStatus: cache.paymentStatus,
          paidAmount: cache.paidAmount,
          paidAt: cache.paidAt,
          paymentMethod: cache.paymentMethod,
          cardInstallmentCount: cache.cardInstallmentCount,
          paymentNotes: cache.paymentNotes
        },
        { transaction: t }
      );
    } else {
      const totalAmount = toMoney(sale.totalAmount);
      const paidAmount =
        input.body.paidAmount !== undefined && input.body.paidAmount !== null
          ? parsePaidAmount(input.body.paidAmount)
          : toMoney(sale.paidAmount);

      validatePaymentConsistency({
        saleStatus: sale.status,
        totalAmount,
        paymentStatus,
        paidAmount
      });

      const paidAt = resolvePaidAtForPaymentUpdate({
        paymentStatus,
        paidAt: input.body.paidAt,
        existingPaidAt: sale.paidAt
      });

      const cache = await applyLegacyAbsolutePayment(
        sale,
        {
          targetPaidAmount: paidAmount,
          paymentStatus,
          paymentMethod: nextMethod,
          cardInstallmentCount: nextInstallments,
          paymentNotes: nextNotes,
          paidAt,
          actorUserId
        },
        t
      );

      await sale.update(
        {
          paymentStatus: cache.paymentStatus,
          paidAmount: cache.paidAmount,
          paidAt: cache.paidAt,
          paymentMethod: cache.paymentMethod,
          cardInstallmentCount: cache.cardInstallmentCount,
          paymentNotes: cache.paymentNotes
        },
        { transaction: t }
      );
    }

    return sale.id;
  });

  const sale = await findInventorySaleOrThrow(input.companyId, saleId);
  return sale.reload({ include: buildInventorySaleIncludes(input.companyId) });
}
