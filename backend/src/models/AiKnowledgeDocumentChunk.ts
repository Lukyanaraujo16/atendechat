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
import AiKnowledgeBase from "./AiKnowledgeBase";
import AiKnowledgeDocument from "./AiKnowledgeDocument";
import AiKnowledgeDocumentIndexing from "./AiKnowledgeDocumentIndexing";

/**
 * Chunk indexado. O campo embedding (BLOB) NÃO deve ser serializado em APIs admin.
 */
@Table({
  tableName: "AiKnowledgeDocumentChunks",
  paranoid: true,
  indexes: [
    {
      name: "AiKnowledgeDocumentChunks_company_base_enabled_idx",
      fields: ["companyId", "knowledgeBaseId", "enabled"]
    },
    {
      name: "AiKnowledgeDocumentChunks_company_document_idx",
      fields: ["companyId", "knowledgeDocumentId"]
    },
    {
      name: "AiKnowledgeDocumentChunks_company_indexing_idx",
      fields: ["companyId", "indexingId"]
    },
    {
      name: "AiKnowledgeDocumentChunks_indexing_chunkIndex_unique",
      unique: true,
      fields: ["indexingId", "chunkIndex"]
    }
  ]
})
class AiKnowledgeDocumentChunk extends Model<AiKnowledgeDocumentChunk> {
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

  @ForeignKey(() => AiKnowledgeDocument)
  @Column
  knowledgeDocumentId: number;

  @BelongsTo(() => AiKnowledgeDocument)
  knowledgeDocument: AiKnowledgeDocument;

  @ForeignKey(() => AiKnowledgeDocumentIndexing)
  @Column
  indexingId: number;

  @BelongsTo(() => AiKnowledgeDocumentIndexing)
  indexing: AiKnowledgeDocumentIndexing;

  @Column
  chunkIndex: number;

  @Column(DataType.STRING(128))
  chunkHash: string;

  @Column(DataType.TEXT)
  content: string;

  @AllowNull(true)
  @Column
  characterStart: number | null;

  @AllowNull(true)
  @Column
  characterEnd: number | null;

  @AllowNull(true)
  @Column
  tokenCount: number | null;

  @Default(true)
  @Column
  tokenCountEstimated: boolean;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  documentType: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(16))
  language: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(40))
  sourceType: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  title: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  sectionTitle: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @Column(DataType.STRING(40))
  embeddingProvider: string;

  @Column(DataType.STRING(120))
  embeddingModel: string;

  @Column
  embeddingDimensions: number;

  @Column(DataType.STRING(80))
  embeddingVersion: string;

  @AllowNull(true)
  @Column(DataType.BLOB)
  embedding: Buffer | null;

  @Default(false)
  @Column
  enabled: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AiKnowledgeDocumentChunk;
