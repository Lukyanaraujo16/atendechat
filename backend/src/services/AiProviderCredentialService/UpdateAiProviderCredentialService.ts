import AiProviderCredential from "../../models/AiProviderCredential";
import {
  encryptAiProviderApiKey
} from "../../helpers/aiProviderCredentialCrypto";
import { maskSecret } from "../../helpers/maskSecret";
import { parseBooleanField } from "../AiAgentService/aiAgentTenant";
import {
  findAiProviderCredentialOrThrow,
  serializeAiProviderCredential
} from "./aiProviderCredentialSerialize";
import {
  parseCredentialName,
  parseOptionalApiKey,
  parseProvider
} from "./aiProviderCredentialValidation";
import { clearOtherDefaultCredentials } from "./clearOtherDefaultCredentials";

type UpdateBody = Record<string, unknown>;

export default async function UpdateAiProviderCredentialService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}) {
  const row = await findAiProviderCredentialOrThrow(input.companyId, input.id);
  const body = input.body;
  const patch: Record<string, unknown> = {};
  let effectiveProvider = parseProvider(row.provider);

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    patch.name = parseCredentialName(body.name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "provider")) {
    effectiveProvider = parseProvider(body.provider);
    patch.provider = effectiveProvider;
  }
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    patch.enabled = parseBooleanField(body.enabled, row.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(body, "isDefault")) {
    const nextDefault = parseBooleanField(body.isDefault, row.isDefault);
    patch.isDefault = nextDefault;
    if (nextDefault) {
      await clearOtherDefaultCredentials(input.companyId, row.id);
    }
  }

  const nextApiKey = parseOptionalApiKey(body.apiKey, effectiveProvider);
  if (nextApiKey) {
    patch.apiKeyEncrypted = encryptAiProviderApiKey(nextApiKey);
    patch.apiKeyMasked = maskSecret(nextApiKey);
  }

  await row.update(patch);
  return serializeAiProviderCredential(await row.reload());
}
