import { ToolManifest } from "../contracts/ToolContract";
import { toolSchemaToJsonSchema } from "../schemaValidation";

export type NeutralToolDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  metadata: {
    riskLevel: string;
    sideEffectType: string;
    capabilities: string[];
  };
};

export type OpenAiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GeminiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/**
 * Formato interno neutro — não acoplado a OpenAI/Gemini.
 */
export function toNeutralToolDefinition(
  manifest: ToolManifest
): NeutralToolDefinition {
  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    parameters: toolSchemaToJsonSchema(manifest.inputSchema),
    metadata: {
      riskLevel: manifest.riskLevel,
      sideEffectType: manifest.sideEffectType,
      capabilities: manifest.capabilities.map(String)
    }
  };
}

/**
 * Adapter OpenAI function calling (somente schema — sem dispatch).
 * Nome do function = id da Tool (estável). Versão via allowlist separada.
 */
export function toOpenAiToolDefinition(
  manifest: ToolManifest
): OpenAiToolDefinition {
  return {
    type: "function",
    function: {
      name: manifest.id.replace(/\./g, "_"),
      description: `${manifest.description} [${manifest.id}@${manifest.version}]`,
      parameters: toolSchemaToJsonSchema(manifest.inputSchema)
    }
  };
}

/**
 * Adapter Gemini function declarations (somente schema — sem dispatch).
 */
export function toGeminiToolDefinition(
  manifest: ToolManifest
): GeminiToolDefinition {
  return {
    name: manifest.id.replace(/\./g, "_"),
    description: `${manifest.description} [${manifest.id}@${manifest.version}]`,
    parameters: toolSchemaToJsonSchema(manifest.inputSchema)
  };
}

export type ProviderToolDefinitions = {
  neutral: NeutralToolDefinition[];
  openai: OpenAiToolDefinition[];
  gemini: GeminiToolDefinition[];
  allowlist: Array<{ id: string; version: string; key: string }>;
};

/**
 * Gera definições de provider a partir de Tools elegíveis.
 * NÃO despacha execução. NÃO conecta ao Live Mode.
 * Somente Tools com exposeToModel=true entram (técnicas ficam de fora).
 */
export function buildProviderToolDefinitions(
  manifests: ToolManifest[]
): ProviderToolDefinitions {
  const eligible = manifests.filter(
    m => m.exposeToModel === true && !m.deprecated
  );

  return {
    neutral: eligible.map(toNeutralToolDefinition),
    openai: eligible.map(toOpenAiToolDefinition),
    gemini: eligible.map(toGeminiToolDefinition),
    allowlist: eligible.map(m => ({
      id: m.id,
      version: m.version,
      key: `${m.id}@${m.version}`
    }))
  };
}

export default buildProviderToolDefinitions;
