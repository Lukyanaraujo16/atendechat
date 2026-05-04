import CrmPipeline from "../../models/CrmPipeline";
import CrmStage from "../../models/CrmStage";
import AppError from "../../errors/AppError";

export default async function ListCrmStagesService(input: {
  companyId: number;
  pipelineId: number;
}): Promise<CrmStage[]> {
  const pipeline = await CrmPipeline.findOne({
    where: { id: input.pipelineId, companyId: input.companyId }
  });
  if (!pipeline) {
    throw new AppError("ERR_NO_CRM_PIPELINE", 404);
  }
  return CrmStage.findAll({
    where: { pipelineId: input.pipelineId, companyId: input.companyId },
    order: [["position", "ASC"]]
  });
}
