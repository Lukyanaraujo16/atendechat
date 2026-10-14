import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import sequelize from "../../database";
import { recordFinancialEvent } from "./recordFinancialEvent";

export async function cancelSaasInvoice(input: {
  invoiceId: number;
  companyId: number;
  actorUserId: number;
  reason: string;
}): Promise<Invoices> {
  if (!input.reason?.trim()) {
    throw new AppError("ERR_CANCEL_REASON_REQUIRED", 400);
  }

  return sequelize.transaction(async t => {
    const invoice = await Invoices.findOne({
      where: { id: input.invoiceId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    const status = String(invoice.status).toLowerCase();
    if (status === "paid") {
      throw new AppError("ERR_CANNOT_CANCEL_PAID_INVOICE", 400);
    }
    if (status === "cancelled") {
      return invoice;
    }

    await invoice.update(
      {
        status: "cancelled",
        cancelledAt: new Date()
      },
      { transaction: t }
    );

    await recordFinancialEvent({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      eventType: "invoice_cancelled",
      actorUserId: input.actorUserId,
      payload: { reason: input.reason.trim() },
      transaction: t
    });

    await invoice.reload({ transaction: t });
    return invoice;
  });
}
