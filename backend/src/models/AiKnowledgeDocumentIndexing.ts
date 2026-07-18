import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AiKnowledgeDocument from "./AiKnowledgeDocument";
import type { KnowledgeIndexingRecordStatus } from "../config/knowledgeBaseConstants";

@Table({
  tableName: "AiKnowledgeDocumentIndexings",
  indexes: [
    {
      name: "AiKnowledgeDocumentIndexings_company_document_idx",
      fields: ["companyId", "knowledgeDocumentId"]
    },
    {
      name: "AiKnowledgeDocumentIndexings_company_status_idx",
      fields: ["companyId", "status"]
    },
    {
      name: "AiKnowledgeDocumentIndexings_company_document_active_idx",
      fields: ["companyId", "knowledgeDocumentId", "isActive"]
    }
  ]
})
class AiKnowledgeDocumentIndexing extends Model<AiKnowledgeDocumentIndexing> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiKnowledgeDocument)
  @Column
  knowledgeDocumentId: number;

  @BelongsTo(() => AiKnowledgeDocument)
  knowledgeDocument: AiKnowledgeDocument;

  @Default("queued")
  @Column(DataType.STRING(40))
  status: KnowledgeIndexingRecordStatus;

  @Default(1)
  @Column
  attempt: number;

  @Column(DataType.STRING(64))
  indexVersion: string;

  @Column(DataType.STRING(40))
  chunkingVersion: string;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  embeddingProvider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  embeddingModel: string | null;

  @AllowNull(true)
  @Column
  embeddingDimensions: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  sourceChecksum: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  contentHash: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  configurationHash: string | null;

  @Default(0)
  @Column
  chunksGenerated: number;

  @Default(0)
  @Column
  chunksEmbedded: number;

  @Default(0)
  @Column
  charactersProcessed: number;

  @AllowNull(true)
  @Column
  tokensEstimated: number | null;

  @Default(false)
  @Column
  isActive: boolean;

  @AllowNull(true)
  @Column
  startedAt: Date | null;

  @AllowNull(true)
  @Column
  finishedAt: Date | null;

  @AllowNull(true)
  @Column
  durationMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(80))
  errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorMessage: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  logs: Record<string, unknown>[] | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeDocumentIndexing;
