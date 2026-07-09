import AiProviderCredential from "../../models/AiProviderCredential";
import {
  encryptAiProviderApiKey
} from "../../helpers/aiProviderCredentialCrypto";
import { maskSecret } from "../../helpers/maskSecret";
import { parseBooleanField } from "../AiAgentService/aiAgentTenant";
import {
  parseCredentialName,
  parseProvider,
  validateApiKeyForProvider
} from "./aiProviderCredentialValidation";
import { clearOtherDefaultCredentials } from "./clearOtherDefaultCredentials";
import { serializeAiProviderCredential } from "./aiProviderCredentialSerialize";

type CreateBody = Record<string, unknown>;

export default async function CreateAiProviderCredentialService(input: {
  companyId: number;
  body: CreateBody;
}) {
  const name = parseCredentialName(input.body.name);
  const provider = parseProvider(input.body.provider);
  const apiKey = validateApiKeyForProvider(provider, input.body.apiKey);
  const enabled = parseBooleanField(input.body.enabled, true);
  const isDefault = parseBooleanField(input.body.isDefault, false);

  if (isDefault) {
    await clearOtherDefaultCredentials(input.companyId);
  }

  const row = await AiProviderCredential.create({
    companyId: input.companyId,
    name,
    provider,
    apiKeyEncrypted: encryptAiProviderApiKey(apiKey),
    apiKeyMasked: maskSecret(apiKey),
    enabled,
    isDefault
  });

  return serializeAiProviderCredential(row);
}
