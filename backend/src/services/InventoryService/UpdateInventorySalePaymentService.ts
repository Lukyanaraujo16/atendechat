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
  inventorySaleIncludes,
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

  const patch: Partial<InventorySale> = {
    paymentStatus,
    paidAmount
  };

  if (input.body.paymentMethod !== undefined) {
    patch.paymentMethod = parseOptionalPaymentMethod(input.body.paymentMethod);
  }

  if (input.body.paymentNotes !== undefined) {
    patch.paymentNotes = normalizeOptionalString(input.body.paymentNotes);
  }

  patch.paidAt = resolvePaidAtForPaymentUpdate({
    paymentStatus,
    paidAt: input.body.paidAt,
    existingPaidAt: sale.paidAt
  });

  await sale.update(patch);
  return sale.reload({ include: inventorySaleIncludes });
}
