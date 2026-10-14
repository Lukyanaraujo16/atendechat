import { Transaction } from "sequelize";
import SaaSFinancialEvent from "../../models/SaaSFinancialEvent";

export type RecordFinancialEventInput = {
  companyId: number;
  invoiceId?: number | null;
  paymentId?: number | null;
  eventType: string;
  actorUserId?: number | null;
  idempotencyKey?: string | null;
  payload?: Record<string, unknown> | null;
  transaction?: Transaction;
};

export async function recordFinancialEvent(
  input: RecordFinancialEventInput
): Promise<SaaSFinancialEvent | null> {
  if (input.idempotencyKey) {
    const existing = await SaaSFinancialEvent.findOne({
      where: { idempotencyKey: input.idempotencyKey },
      transaction: input.transaction
    });
    if (existing) return existing;
  }

  try {
    return await SaaSFinancialEvent.create(
      {
        companyId: input.companyId,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        payload: input.payload ?? null
      },
      { transaction: input.transaction }
    );
  } catch (err: any) {
    if (input.idempotencyKey && err?.name === "SequelizeUniqueConstraintError") {
      return SaaSFinancialEvent.findOne({
        where: { idempotencyKey: input.idempotencyKey },
        transaction: input.transaction
      });
    }
    throw err;
  }
}
