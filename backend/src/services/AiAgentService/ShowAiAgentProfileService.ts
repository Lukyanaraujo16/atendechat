import AiAgentProfile from "../../models/AiAgentProfile";
import { findAiAgentOrThrow } from "./aiAgentTenant";

export default async function ShowAiAgentProfileService(input: {
  companyId: number;
  aiAgentId: number;
}): Promise<AiAgentProfile | null> {
  await findAiAgentOrThrow(input.companyId, input.aiAgentId);
  return AiAgentProfile.findOne({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });
}
