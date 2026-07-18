import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import AiKnowledgeBase from "./AiKnowledgeBase";
import type {
  KnowledgeDocumentStatus,
  KnowledgeDocumentType,
  KnowledgeIndexStatus,
  KnowledgeProcessingStatus,
  KnowledgeSourceType,
  KnowledgeUploadStatus
} from "../config/knowledgeBaseConstants";

/**
 * Documento cadastrado numa Base de Conhecimento.
 * 1.5.2B: pipeline de extração textual (upload/processing/index statuses).
 * Chunks/embeddings (1.5.2C) e RAG (1.5.2D) virão depois.
 */
@Table({
  tableName: "AiKnowledgeDocuments",
  paranoid: true,
  indexes: [
    {
      name: "AiKnowledgeDocuments_companyId_knowledgeBaseId_idx",
      fields: ["companyId", "knowledgeBaseId"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_status_idx",
      fields: ["companyId", "status"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_processingStatus_idx",
      fields: ["companyId", "processingStatus"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_uploadStatus_idx",
      fields: ["companyId", "uploadStatus"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_indexStatus_idx",
      fields: ["companyId", "indexStatus"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_documentType_idx",
      fields: ["companyId", "documentType"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_sourceType_idx",
      fields: ["companyId", "sourceType"]
    },
    {
      name: "AiKnowledgeDocuments_companyId_deletedAt_idx",
      fields: ["companyId", "deletedAt"]
    }
  ]
})
class AiKnowledgeDocument extends Model<AiKnowledgeDocument> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiKnowledgeBase)
  @Column
  knowledgeBaseId: number;

  @BelongsTo(() => AiKnowledgeBase)
  knowledgeBase: AiKnowledgeBase;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string | null;

  @Default("general")
  @Column(DataType.STRING(40))
  documentType: KnowledgeDocumentType;

  @Default("manual")
  @Column(DataType.STRING(40))
  sourceType: KnowledgeSourceType;

  @Default("draft")
  @Column(DataType.STRING(40))
  status: KnowledgeDocumentStatus;

  @Default("pending")
  @Column(DataType.STRING(40))
  uploadStatus: KnowledgeUploadStatus;

  @Default("pending")
  @Column(DataType.STRING(40))
  processingStatus: KnowledgeProcessingStatus;

  @Default("pending")
  @Column(DataType.STRING(40))
  indexStatus: KnowledgeIndexStatus;

  @Default("pt-BR")
  @AllowNull(true)
  @Column(DataType.STRING(16))
  language: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  contentText: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  contentMarkdown: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(2048))
  sourceUrl: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  fileName: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  mimeType: string | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  fileSize: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  checksum: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(512))
  storagePath: string | null;

  @AllowNull(true)
  @Column
  lastProcessedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  lastProcessor: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lastProcessingError: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  lastProcessedChecksum: string | null;

  @AllowNull(true)
  @Column
  lastProcessingDurationMs: number | null;

  @AllowNull(true)
  @Column
  lastIndexedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lastIndexingError: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  lastIndexedChecksum: string | null;

  @AllowNull(true)
  @Column
  lastIndexingDurationMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  lastEmbeddingProvider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  lastEmbeddingModel: string | null;

  @AllowNull(true)
  @Column
  lastEmbeddingDimensions: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  lastChunkingVersion: string | null;

  @Default(0)
  @Column
  chunkCount: number;

  @AllowNull(true)
  @Column
  activeIndexingId: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AiKnowledgeDocument;
