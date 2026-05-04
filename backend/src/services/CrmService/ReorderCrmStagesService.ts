import { Transaction } from "sequelize";
import sequelize from "../../database";
import CrmPipeline from "../../models/CrmPipeline";
import CrmStage from "../../models/CrmStage";
import AppError from "../../errors/AppError";

export default async function ReorderCrmStagesService(input: {
  companyId: number;
  pipelineId: number;
  stageIds: number[];
}): Promise<CrmStage[]> {
  const { companyId, pipelineId, stageIds } = input;

  if (!Array.isArray(stageIds) || stageIds.length === 0) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const pipeline = await CrmPipeline.findOne({
    where: { id: pipelineId, companyId }
  });
  if (!pipeline) {
    throw new AppError("ERR_NO_CRM_PIPELINE", 404);
  }

  const existing = await CrmStage.findAll({
    where: { pipelineId, companyId },
    attributes: ["id"],
    order: [["position", "ASC"]]
  });

  if (existing.length !== stageIds.length) {
    throw new AppError("ERR_CRM_STAGE_REORDER_MISMATCH", 400);
  }

  const idSet = new Set(existing.map((r) => r.id));
  const seen = new Set<number>();
  for (const sid of stageIds) {
    if (!Number.isFinite(sid) || !idSet.has(sid) || seen.has(sid)) {
      throw new AppError("ERR_CRM_STAGE_REORDER_MISMATCH", 400);
    }
    seen.add(sid);
  }

  await sequelize.transaction(async (t: Transaction) => {
    for (let i = 0; i < stageIds.length; i++) {
      await CrmStage.update(
        { position: i },
        {
          where: { id: stageIds[i], companyId, pipelineId },
          transaction: t
        }
      );
    }
  });

  return CrmStage.findAll({
    where: { pipelineId, companyId },
    order: [["position", "ASC"]]
  });
}
