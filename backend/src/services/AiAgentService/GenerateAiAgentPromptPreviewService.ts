import { AI_AGENT_GENERATED_PROMPT_VERSION } from "../../config/aiAgentProfileConfig";
import { buildAiAgentPromptFromProfile } from "./buildAiAgentPromptFromProfile";
import { validateAiAgentProfileInput } from "./aiAgentProfileValidation";
import { findAiAgentOrThrow } from "./aiAgentTenant";
import { buildAiAgentAdminPromptPreview } from "./aiAgentHandoffPolicy";

export default async function GenerateAiAgentPromptPreviewService(input: {
  companyId: number;
  aiAgentId: number;
  body: Record<string, unknown>;
}): Promise<{
  generatedPrompt: string;
  generatedPromptVersion: string;
}> {
  await findAiAgentOrThrow(input.companyId, input.aiAgentId);
  const validated = validateAiAgentProfileInput(input.body);
  const generatedPrompt = buildAiAgentAdminPromptPreview(
    buildAiAgentPromptFromProfile(validated)
  );
  return {
    generatedPrompt,
    generatedPromptVersion: AI_AGENT_GENERATED_PROMPT_VERSION
  };
}
