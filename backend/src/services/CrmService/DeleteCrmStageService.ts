import CrmDeal from "../../models/CrmDeal";
import CrmStage from "../../models/CrmStage";
import AppError from "../../errors/AppError";

export default async function DeleteCrmStageService(input: {
  companyId: number;
  stageId: number;
}): Promise<void> {
  const stage = await CrmStage.findOne({
    where: { id: input.stageId, companyId: input.companyId }
  });
  if (!stage) {
    throw new AppError("ERR_NO_CRM_STAGE", 404);
  }

  const dealCount = await CrmDeal.count({
    where: { stageId: stage.id, companyId: input.companyId }
  });
  if (dealCount > 0) {
    throw new AppError("ERR_STAGE_HAS_DEALS", 400);
  }

  await stage.destroy();
}
