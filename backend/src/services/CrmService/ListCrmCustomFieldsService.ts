import { Op } from "sequelize";
import CrmCustomField from "../../models/CrmCustomField";

export default async function ListCrmCustomFieldsService(input: {
  companyId: number;
  pipelineId?: number | null;
}): Promise<CrmCustomField[]> {
  const where =
    input.pipelineId != null &&
    input.pipelineId !== undefined &&
    Number.isFinite(Number(input.pipelineId))
      ? {
          companyId: input.companyId,
          [Op.or]: [
            { pipelineId: null },
            { pipelineId: Number(input.pipelineId) }
          ]
        }
      : { companyId: input.companyId };

  return CrmCustomField.findAll({
    where,
    order: [
      ["position", "ASC"],
      ["id", "ASC"]
    ]
  });
}
