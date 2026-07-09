import AiAgent from "../../models/AiAgent";
import {
  normalizeOptionalString,
  parseBooleanField,
  parseRequiredName
} from "./aiAgentTenant";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModel,
  parseAiAgentTemperature
} from "./aiAgentValidation";
import { parseAiProviderCredentialId } from "./parseAiProviderCredentialId";

type CreateBody = Record<string, unknown>;

export default async function CreateAiAgentService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<AiAgent> {
  const name = parseRequiredName(input.body.name);
  const aiProviderCredentialId = await parseAiProviderCredentialId(
    input.companyId,
    input.body.aiProviderCredentialId ?? null
  );

  return AiAgent.create({
    companyId: input.companyId,
    name,
    description: normalizeOptionalString(input.body.description),
    enabled: parseBooleanField(input.body.enabled, false),
    model: parseAiAgentModel(input.body.model),
    temperature: parseAiAgentTemperature(input.body.temperature),
    maxTokens: parseAiAgentMaxTokens(input.body.maxTokens),
    systemPrompt: normalizeOptionalString(input.body.systemPrompt),
    fallbackMessage: normalizeOptionalString(input.body.fallbackMessage),
    handoffMessage: normalizeOptionalString(input.body.handoffMessage),
    aiProviderCredentialId,
    allowAudioInput: false,
    allowAudioOutput: false
  });
}
