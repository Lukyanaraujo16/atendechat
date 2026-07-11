import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";

export function resolveAiAgentBusinessPrompt(
  agent: AiAgent,
  profile?: AiAgentProfile | null
): string | null {
  const setupMode = profile?.setupMode;

  if (setupMode === "guided") {
    const generated = profile?.generatedPrompt?.trim();
    if (generated) return generated;
    return null;
  }

  if (setupMode === "advanced") {
    return agent.systemPrompt?.trim() || null;
  }

  return agent.systemPrompt?.trim() || null;
}

export async function loadAiAgentProfileForRuntime(input: {
  companyId: number;
  aiAgentId: number;
}): Promise<AiAgentProfile | null> {
  return AiAgentProfile.findOne({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });
}
