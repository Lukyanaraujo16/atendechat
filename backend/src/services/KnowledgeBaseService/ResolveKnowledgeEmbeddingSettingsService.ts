import crypto from "crypto";
import AppError from "../../errors/AppError";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";
import AiProviderCredential from "../../models/AiProviderCredential";
import {
  KNOWLEDGE_CHUNKING_VERSION,
  KNOWLEDGE_DEFAULT_CHUNK_OVERLAP,
  KNOWLEDGE_DEFAULT_CHUNK_SIZE,
  KNOWLEDGE_DEFAULT_EMBEDDING_BATCH_SIZE,
  KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE
} from "../../config/knowledgeBaseConstants";
import {
  DEFAULT_EMBEDDING_MODEL_BY_PROVIDER,
  resolveEmbeddingModelConfiguration
} from "../../config/knowledgeEmbeddingModels";
import {
  AI_PROVIDER_OPENAI,
  isAiProviderId
} from "../../config/aiProviderModels";
import { decryptAiProviderApiKey } from "../../helpers/aiProviderCredentialCrypto";
import { EmbeddingProviderFactory } from "./embeddings/EmbeddingProviderFactory";
import { assertVectorStoreReadyForModel } from "./vector";

export type ResolvedEmbeddingSettings = {
  settings: AiKnowledgeEmbeddingSettings;
  apiKey: string;
  provider: string;
  model: string;
  dimensions: number;
  embeddingVersion: string;
  configurationHash: string;
};

export function buildConfigurationHash(input: {
  provider: string;
  model: string;
  dimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  chunkingVersion: string;
  embeddingVersion: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        input.provider,
        input.model,
        input.dimensions,
        input.chunkSize,
        input.chunkOverlap,
        input.minChunkSize,
        input.chunkingVersion,
        input.embeddingVersion
      ].join("|")
    )
    .digest("hex");
}

export function contentHashFromText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export default async function ResolveKnowledgeEmbeddingSettingsService(input: {
  companyId: number;
  requireEnabled?: boolean;
  /** Usado no teste de credencial — não exige VectorStore operacional. */
  skipVectorStoreCheck?: boolean;
}): Promise<ResolvedEmbeddingSettings> {
  const settings = await AiKnowledgeEmbeddingSettings.findOne({
    where: { companyId: input.companyId }
  });

  if (!settings) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_SETTINGS_MISSING",
      400,
      "Configure o provedor de embeddings da Base de Conhecimento antes de indexar."
    );
  }

  if (input.requireEnabled !== false && !settings.enabled) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_DISABLED",
      400,
      "Indexação de embeddings está desativada para esta empresa."
    );
  }

  if (!isAiProviderId(settings.provider)) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_PROVIDER",
      400,
      "Provider de embedding inválido na configuração."
    );
  }

  // Dimensão e compatibilidade vêm do catálogo backend — nunca do frontend.
  const modelCfg = resolveEmbeddingModelConfiguration(
    settings.provider,
    settings.model
  );

  // Validar VectorStore antes de indexar (falha cedo, sem job eterno).
  if (!input.skipVectorStoreCheck) {
    await assertVectorStoreReadyForModel({
      provider: modelCfg.provider,
      model: modelCfg.model
    });
  }

  if (settings.dimensions !== modelCfg.dimensions) {
    await settings.update({ dimensions: modelCfg.dimensions });
  }

  if (!settings.credentialId) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
      400,
      "Selecione uma credencial de IA para embeddings."
    );
  }

  const credential = await AiProviderCredential.findOne({
    where: {
      id: settings.credentialId,
      companyId: input.companyId,
      enabled: true
    }
  });

  if (!credential) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
      400,
      "Credencial de embedding não encontrada ou desativada."
    );
  }

  if (credential.provider !== settings.provider) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
      400,
      "A credencial selecionada não é compatível com o provider de embedding."
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptAiProviderApiKey(credential.apiKeyEncrypted).trim();
  } catch {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
      500,
      "Não foi possível utilizar a credencial de embedding."
    );
  }
  if (!apiKey) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
      400,
      "Credencial de embedding vazia."
    );
  }

  return {
    settings,
    apiKey,
    provider: settings.provider,
    model: settings.model,
    dimensions: modelCfg.dimensions,
    embeddingVersion: modelCfg.embeddingVersion,
    configurationHash: buildConfigurationHash({
      provider: settings.provider,
      model: settings.model,
      dimensions: modelCfg.dimensions,
      chunkSize: settings.chunkSize || KNOWLEDGE_DEFAULT_CHUNK_SIZE,
      chunkOverlap: settings.chunkOverlap || KNOWLEDGE_DEFAULT_CHUNK_OVERLAP,
      minChunkSize: settings.minChunkSize || KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE,
      chunkingVersion: KNOWLEDGE_CHUNKING_VERSION,
      embeddingVersion: modelCfg.embeddingVersion
    })
  };
}

export async function getOrCreateDefaultEmbeddingSettings(
  companyId: number,
  userId: number | null
): Promise<AiKnowledgeEmbeddingSettings> {
  const existing = await AiKnowledgeEmbeddingSettings.findOne({
    where: { companyId }
  });
  if (existing) return existing;

  const defaultCred = await AiProviderCredential.findOne({
    where: { companyId, enabled: true, isDefault: true },
    order: [["id", "ASC"]]
  });

  const provider = isAiProviderId(defaultCred?.provider || "")
    ? defaultCred!.provider
    : AI_PROVIDER_OPENAI;
  const model = DEFAULT_EMBEDDING_MODEL_BY_PROVIDER[provider as "openai" | "gemini"];
  const def = resolveEmbeddingModelConfiguration(provider, model);

  return AiKnowledgeEmbeddingSettings.create({
    companyId,
    credentialId: defaultCred?.id ?? null,
    provider,
    model,
    dimensions: def.dimensions,
    enabled: true,
    chunkSize: KNOWLEDGE_DEFAULT_CHUNK_SIZE,
    chunkOverlap: KNOWLEDGE_DEFAULT_CHUNK_OVERLAP,
    minChunkSize: KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE,
    batchSize: KNOWLEDGE_DEFAULT_EMBEDDING_BATCH_SIZE,
    createdBy: userId,
    updatedBy: userId
  });
}

export async function ValidateKnowledgeEmbeddingCredentialService(input: {
  companyId: number;
  credentialId?: number | null;
  provider?: string;
  model?: string;
}): Promise<{ ok: boolean; message: string }> {
  const resolved = await ResolveKnowledgeEmbeddingSettingsService({
    companyId: input.companyId,
    requireEnabled: false,
    skipVectorStoreCheck: true
  }).catch(async () => {
    // permitir teste com overrides do body via settings parciais
    return null;
  });

  const provider = input.provider || resolved?.provider;
  const model = input.model || resolved?.model;
  const credentialId = input.credentialId ?? resolved?.settings.credentialId;

  if (!provider || !model || !credentialId) {
    return {
      ok: false,
      message: "Informe provider, modelo e credencial para testar."
    };
  }

  const credential = await AiProviderCredential.findOne({
    where: { id: credentialId, companyId: input.companyId, enabled: true }
  });
  if (!credential) {
    return { ok: false, message: "Credencial não encontrada." };
  }

  let apiKey: string;
  try {
    apiKey = decryptAiProviderApiKey(credential.apiKeyEncrypted).trim();
  } catch {
    return { ok: false, message: "Falha ao ler credencial." };
  }

  const embProvider = EmbeddingProviderFactory(provider);
  return embProvider.validateCredential({ apiKey, model });
}
