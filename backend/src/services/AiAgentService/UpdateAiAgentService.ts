import {
  normalizeOptionalString,
  parseBooleanField,
  parseRequiredName,
  findAiAgentOrThrow
} from "./aiAgentTenant";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModel,
  parseAiAgentTemperature
} from "./aiAgentValidation";
import { parseAiProviderCredentialId } from "./parseAiProviderCredentialId";

type UpdateBody = Record<string, unknown>;

export default async function UpdateAiAgentService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}) {
  const agent = await findAiAgentOrThrow(input.companyId, input.id);
  const body = input.body;

  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    patch.name = parseRequiredName(body.name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    patch.description = normalizeOptionalString(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    patch.enabled = parseBooleanField(body.enabled, agent.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(body, "model")) {
    patch.model = parseAiAgentModel(body.model);
  }
  if (Object.prototype.hasOwnProperty.call(body, "temperature")) {
    patch.temperature = parseAiAgentTemperature(body.temperature);
  }
  if (Object.prototype.hasOwnProperty.call(body, "maxTokens")) {
    patch.maxTokens = parseAiAgentMaxTokens(body.maxTokens);
  }
  if (Object.prototype.hasOwnProperty.call(body, "systemPrompt")) {
    patch.systemPrompt = normalizeOptionalString(body.systemPrompt);
  }
  if (Object.prototype.hasOwnProperty.call(body, "fallbackMessage")) {
    patch.fallbackMessage = normalizeOptionalString(body.fallbackMessage);
  }
  if (Object.prototype.hasOwnProperty.call(body, "handoffMessage")) {
    patch.handoffMessage = normalizeOptionalString(body.handoffMessage);
  }
  if (Object.prototype.hasOwnProperty.call(body, "aiProviderCredentialId")) {
    patch.aiProviderCredentialId = await parseAiProviderCredentialId(
      input.companyId,
      body.aiProviderCredentialId
    );
  }

  // Áudio reservado para fase futura — ignorar alterações do cliente.
  patch.allowAudioInput = false;
  patch.allowAudioOutput = false;

  await agent.update(patch);
  return agent.reload();
}
