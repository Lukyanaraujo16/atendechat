import {
  AI_AGENT_GENERATED_PROMPT_VERSION,
  AI_AGENT_PROFILE_SCHEMA_VERSION
} from "../../config/aiAgentProfileConfig";
import AiAgentProfile from "../../models/AiAgentProfile";
import { buildAiAgentPromptFromProfile } from "./buildAiAgentPromptFromProfile";
import { validateAiAgentProfileInput } from "./aiAgentProfileValidation";
import { findAiAgentOrThrow } from "./aiAgentTenant";

export default async function UpsertAiAgentProfileService(input: {
  companyId: number;
  aiAgentId: number;
  body: Record<string, unknown>;
}): Promise<AiAgentProfile> {
  await findAiAgentOrThrow(input.companyId, input.aiAgentId);
  const validated = validateAiAgentProfileInput(input.body);
  const generatedPrompt = buildAiAgentPromptFromProfile(validated);
  const generatedAt = new Date();

  const payload = {
    ...validated,
    schemaVersion: AI_AGENT_PROFILE_SCHEMA_VERSION,
    setupMode: "guided" as const,
    generatedPrompt,
    generatedPromptVersion: AI_AGENT_GENERATED_PROMPT_VERSION,
    generatedAt
  };

  const existing = await AiAgentProfile.findOne({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });

  if (existing) {
    await existing.update(payload);
    return existing.reload();
  }

  return AiAgentProfile.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    ...payload
  });
}
