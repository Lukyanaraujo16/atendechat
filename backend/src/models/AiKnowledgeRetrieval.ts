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
import AiAgent from "./AiAgent";

@Table({
  tableName: "AiKnowledgeRetrievals",
  indexes: [
    {
      name: "AiKnowledgeRetrievals_company_agent_created_idx",
      fields: ["companyId", "aiAgentId", "createdAt"]
    },
    {
      name: "AiKnowledgeRetrievals_company_channel_status_idx",
      fields: ["companyId", "channel", "status"]
    },
    {
      name: "AiKnowledgeRetrievals_company_requestId_idx",
      fields: ["companyId", "requestId"]
    }
  ]
})
class AiKnowledgeRetrieval extends Model<AiKnowledgeRetrieval> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @Column(DataType.STRING(32))
  channel: string;

  @AllowNull(true)
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(191))
  messageId: string | null;

  @AllowNull(true)
  @Column
  simulationSessionId: number | null;

  @AllowNull(true)
  @Column
  shadowSuggestionId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  requestId: string | null;

  @Default("skipped")
  @Column(DataType.STRING(32))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  queryHash: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(240))
  queryPreview: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  knowledgeBaseIds: number[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  documentTypes: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  languages: string[] | null;

  @AllowNull(true)
  @Column
  topK: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  minimumScore: number | null;

  @Default(0)
  @Column
  candidateCount: number;

  @Default(0)
  @Column
  returnedChunkCount: number;

  @Default(0)
  @Column
  returnedDocumentCount: number;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  embeddingProvider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  embeddingModel: string | null;

  @AllowNull(true)
  @Column
  embeddingDimensions: number | null;

  @Default(0)
  @Column
  contextCharacters: number;

  @Default(0)
  @Column
  estimatedContextTokens: number;

  @Default(0)
  @Column
  durationMs: number;

  @Default(0)
  @Column
  embeddingDurationMs: number;

  @Default(0)
  @Column
  searchDurationMs: number;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  skippedReason: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  errorMessage: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeRetrieval;
