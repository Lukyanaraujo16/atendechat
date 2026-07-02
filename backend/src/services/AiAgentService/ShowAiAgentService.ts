import { findAiAgentOrThrow } from "./aiAgentTenant";

export default async function ShowAiAgentService(input: {
  companyId: number;
  id: number;
}) {
  return findAiAgentOrThrow(input.companyId, input.id);
}
