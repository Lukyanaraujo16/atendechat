import { Op, Transaction } from "sequelize";
import CrmDealStageHistory from "../../models/CrmDealStageHistory";

export async function closeOpenCrmDealStageHistory(
  input: {
    companyId: number;
    dealId: number;
    leftAt: Date;
  },
  transaction?: Transaction
): Promise<void> {
  const open = await CrmDealStageHistory.findOne({
    where: {
      companyId: input.companyId,
      dealId: input.dealId,
      leftAt: { [Op.is]: null }
    },
    transaction
  });
  if (!open) {
    return;
  }
  const entered = new Date(open.enteredAt).getTime();
  const left = input.leftAt.getTime();
  const durationMs = left >= entered ? left - entered : 0;
  await open.update(
    { leftAt: input.leftAt, durationMs },
    { transaction }
  );
}

export async function openCrmDealStageHistoryRecord(input: {
  companyId: number;
  dealId: number;
  fromStageId: number | null;
  toStageId: number;
  enteredAt: Date;
  changedBy: number | null;
  transaction?: Transaction;
}): Promise<CrmDealStageHistory> {
  return CrmDealStageHistory.create(
    {
      companyId: input.companyId,
      dealId: input.dealId,
      fromStageId: input.fromStageId,
      toStageId: input.toStageId,
      enteredAt: input.enteredAt,
      leftAt: null,
      durationMs: null,
      changedBy: input.changedBy
    },
    { transaction: input.transaction }
  );
}
