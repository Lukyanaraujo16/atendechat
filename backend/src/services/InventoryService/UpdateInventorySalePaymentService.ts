import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import {
  assertSaleAllowsPaymentUpdate,
  parseOptionalPaymentMethod,
  parsePaidAmount,
  parsePaymentStatus,
  resolvePaidAtForPaymentUpdate,
  validatePaymentConsistency
} from "./inventoryPaymentHelpers";
import {
  findInventorySaleOrThrow,
  buildInventorySaleIncludes,
  toMoney
} from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type PaymentBody = {
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  paidAmount?: unknown;
  paidAt?: unknown;
  paymentNotes?: unknown;
};

export default async function UpdateInventorySalePaymentService(input: {
  companyId: number;
  saleId: number;
  body: PaymentBody;
}): Promise<InventorySale> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.saleId);

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

  const patch: Partial<InventorySale> = {};

  if (sale.status === "draft") {
    // Em rascunho só é permitido gravar metadados de pagamento
    // (paymentMethod/paymentNotes). O financeiro permanece zerado:
    // paymentStatus = unpaid, paidAmount = 0, paidAt = null.
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

    patch.paymentStatus = "unpaid";
    patch.paidAmount = 0;
    patch.paidAt = null;
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

    patch.paymentStatus = paymentStatus;
    patch.paidAmount = paidAmount;
    patch.paidAt = resolvePaidAtForPaymentUpdate({
      paymentStatus,
      paidAt: input.body.paidAt,
      existingPaidAt: sale.paidAt
    });
  }

  if (input.body.paymentMethod !== undefined) {
    patch.paymentMethod = parseOptionalPaymentMethod(input.body.paymentMethod);
  }

  if (input.body.paymentNotes !== undefined) {
    patch.paymentNotes = normalizeOptionalString(input.body.paymentNotes);
  }

  await sale.update(patch);
  return sale.reload({ include: buildInventorySaleIncludes(input.companyId) });
}
