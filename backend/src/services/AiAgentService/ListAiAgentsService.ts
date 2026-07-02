import AiAgent from "../../models/AiAgent";

export default async function ListAiAgentsService(input: {
  companyId: number;
}): Promise<AiAgent[]> {
  return AiAgent.findAll({
    where: { companyId: input.companyId },
    order: [["name", "ASC"]]
  });
}
