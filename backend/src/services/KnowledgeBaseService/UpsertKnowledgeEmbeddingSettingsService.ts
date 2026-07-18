import AppError from "../../errors/AppError";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";
import AiProviderCredential from "../../models/AiProviderCredential";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import { Op } from "sequelize";
import {
  KNOWLEDGE_DEFAULT_CHUNK_OVERLAP,
  KNOWLEDGE_DEFAULT_CHUNK_SIZE,
  KNOWLEDGE_DEFAULT_EMBEDDING_BATCH_SIZE,
  KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE
} from "../../config/knowledgeBaseConstants";
import {
  resolveEmbeddingModelConfiguration
} from "../../config/knowledgeEmbeddingModels";
import { isAiProviderId } from "../../config/aiProviderModels";
import {
  getOrCreateDefaultEmbeddingSettings
} from "./ResolveKnowledgeEmbeddingSettingsService";
import MarkKnowledgeDocumentsIndexOutdatedByConfigService from "./MarkKnowledgeDocumentsIndexOutdatedByConfigService";
import { assertVectorStoreReadyForModel } from "./vector";

function serializeSettings(row: AiKnowledgeEmbeddingSettings) {
  return {
    id: row.id,
    companyId: row.companyId,
    credentialId: row.credentialId,
    provider: row.provider,
    model: row.model,
    dimensions: row.dimensions,
    enabled: row.enabled,
    chunkSize: row.chunkSize,
    chunkOverlap: row.chunkOverlap,
    minChunkSize: row.minChunkSize,
    batchSize: row.batchSize,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function ShowKnowledgeEmbeddingSettingsService(input: {
  companyId: number;
  userId?: number | null;
}) {
  const row = await getOrCreateDefaultEmbeddingSettings(
    input.companyId,
    input.userId ?? null
  );
  return serializeSettings(row);
}

export default async function UpsertKnowledgeEmbeddingSettingsService(input: {
  companyId: number;
  userId: number | null;
  body: Record<string, unknown>;
}) {
  const row = await getOrCreateDefaultEmbeddingSettings(
    input.companyId,
    input.userId
  );

  const prevHash = `${row.provider}|${row.model}|${row.dimensions}|${row.chunkSize}|${row.chunkOverlap}|${row.minChunkSize}`;

  const provider =
    input.body.provider != null
      ? String(input.body.provider)
      : row.provider;
  if (!isAiProviderId(provider)) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_PROVIDER",
      400,
      "Provider inválido."
    );
  }

  const model =
    input.body.model != null ? String(input.body.model) : row.model;
  const modelCfg = resolveEmbeddingModelConfiguration(provider, model);
  await assertVectorStoreReadyForModel({
    provider: modelCfg.provider,
    model: modelCfg.model
  });

  let credentialId =
    input.body.credentialId !== undefined
      ? input.body.credentialId == null
        ? null
        : Number(input.body.credentialId)
      : row.credentialId;

  if (credentialId != null) {
    if (!Number.isFinite(credentialId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "credentialId inválido.");
    }
    const cred = await AiProviderCredential.findOne({
      where: { id: credentialId, companyId: input.companyId }
    });
    if (!cred) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
        400,
        "Credencial não encontrada nesta empresa."
      );
    }
    if (cred.provider !== provider) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL",
        400,
        "Credencial incompatível com o provider."
      );
    }
  }

  const chunkSize = Math.max(
    100,
    Number(input.body.chunkSize ?? row.chunkSize) ||
      KNOWLEDGE_DEFAULT_CHUNK_SIZE
  );
  const chunkOverlap = Math.max(
    0,
    Number(input.body.chunkOverlap ?? row.chunkOverlap) ||
      KNOWLEDGE_DEFAULT_CHUNK_OVERLAP
  );
  const minChunkSize = Math.max(
    1,
    Number(input.body.minChunkSize ?? row.minChunkSize) ||
      KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE
  );
  const batchSize = Math.min(
    64,
    Math.max(
      1,
      Number(input.body.batchSize ?? row.batchSize) ||
        KNOWLEDGE_DEFAULT_EMBEDDING_BATCH_SIZE
    )
  );
  const enabled =
    input.body.enabled === undefined
      ? row.enabled
      : Boolean(input.body.enabled);

  await row.update({
    provider,
    model,
    dimensions: modelCfg.dimensions,
    credentialId,
    chunkSize,
    chunkOverlap,
    minChunkSize,
    batchSize,
    enabled,
    updatedBy: input.userId
  });

  const nextHash = `${provider}|${model}|${modelCfg.dimensions}|${chunkSize}|${chunkOverlap}|${minChunkSize}`;
  let outdatedCount = 0;
  if (prevHash !== nextHash) {
    outdatedCount =
      await MarkKnowledgeDocumentsIndexOutdatedByConfigService({
        companyId: input.companyId
      });
  }

  return {
    settings: serializeSettings(await row.reload()),
    outdatedMarked: outdatedCount
  };
}

export async function CountOutdatedKnowledgeDocumentsService(input: {
  companyId: number;
}): Promise<number> {
  return AiKnowledgeDocument.count({
    where: {
      companyId: input.companyId,
      indexStatus: { [Op.in]: ["outdated", "failed", "pending"] },
      processingStatus: "completed"
    }
  });
}
