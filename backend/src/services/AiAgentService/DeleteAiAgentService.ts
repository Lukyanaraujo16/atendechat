import { assertNoAiAgentBindings } from "./aiAgentBindings";
import { findAiAgentOrThrow } from "./aiAgentTenant";

export default async function DeleteAiAgentService(input: {
  companyId: number;
  id: number;
}): Promise<{ id: number; deleted: true }> {
  const agent = await findAiAgentOrThrow(input.companyId, input.id);
  await assertNoAiAgentBindings(agent.id);
  await agent.destroy();
  return { id: agent.id, deleted: true };
}
