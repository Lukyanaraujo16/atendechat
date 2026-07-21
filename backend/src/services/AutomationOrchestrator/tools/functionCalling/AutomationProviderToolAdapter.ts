import { ToolManifest } from "../contracts/ToolContract";
import {
  buildProviderToolDefinitions,
  GeminiToolDefinition,
  NeutralToolDefinition,
  OpenAiToolDefinition,
  ProviderToolDefinitions,
  toGeminiToolDefinition,
  toNeutralToolDefinition,
  toOpenAiToolDefinition
} from "../providers/buildProviderToolDefinitions";

export type ProviderToolAdapterInput = {
  manifests: ToolManifest[];
  provider: "openai" | "gemini" | "claude" | string;
};

export type ProviderToolAdapterOutput = {
  provider: string;
  definitions: ProviderToolDefinitions;
  /** Payload pronto para o adapter do provider. */
  providerPayload: {
    openaiTools?: OpenAiToolDefinition[];
    geminiFunctionDeclarations?: GeminiToolDefinition[];
    neutral: NeutralToolDefinition[];
  };
  /** Claude preparado — vazio nesta fase. */
  claudeTools?: never[];
};

/**
 * Adapter neutro Tool Manifest → schemas de provider.
 * Nunca acopla Tool ao provider; nunca despacha execução.
 */
export function buildProviderToolPayload(
  input: ProviderToolAdapterInput
): ProviderToolAdapterOutput {
  const provider = String(input.provider || "openai").toLowerCase();
  const definitions = buildProviderToolDefinitions(input.manifests);

  if (provider === "claude") {
    return {
      provider: "claude",
      definitions: {
        neutral: [],
        openai: [],
        gemini: [],
        allowlist: []
      },
      providerPayload: { neutral: [] },
      claudeTools: []
    };
  }

  if (provider === "gemini") {
    return {
      provider: "gemini",
      definitions,
      providerPayload: {
        geminiFunctionDeclarations: definitions.gemini,
        neutral: definitions.neutral
      }
    };
  }

  return {
    provider: "openai",
    definitions,
    providerPayload: {
      openaiTools: definitions.openai,
      neutral: definitions.neutral
    }
  };
}

export {
  toNeutralToolDefinition,
  toOpenAiToolDefinition,
  toGeminiToolDefinition
};

export default { buildProviderToolPayload };
