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
  tableName: "AiAgentAnalyticsDailies",
  indexes: [
    {
      name: "AiAgentAnalyticsDailies_company_agent_day_uq",
      unique: true,
      fields: ["companyId", "aiAgentId", "day"]
    }
  ]
})
class AiAgentAnalyticsDaily extends Model<AiAgentAnalyticsDaily> {
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

  @Column(DataType.DATEONLY)
  day: string;

  @Default(0)
  @Column
  totalInteractions: number;

  @Default(0)
  @Column
  simulatorExecutions: number;

  @Default(0)
  @Column
  shadowSuggestions: number;

  @Default(0)
  @Column
  liveResponses: number;

  @Default(0)
  @Column
  knowledgeRetrievals: number;

  @Default(0)
  @Column
  knowledgeHits: number;

  @Default(0)
  @Column
  knowledgeMisses: number;

  @Default(0)
  @Column
  handoffs: number;

  @Default(0)
  @Column
  clarificationRequests: number;

  @Default(0)
  @Column
  failures: number;

  @Default(0)
  @Column(DataType.BIGINT)
  sumResponseTimeMs: number;

  @Default(0)
  @Column
  countResponseTime: number;

  @Default(0)
  @Column(DataType.BIGINT)
  sumRetrievalTimeMs: number;

  @Default(0)
  @Column
  countRetrievalTime: number;

  @Default(0)
  @Column(DataType.BIGINT)
  sumEmbeddingTimeMs: number;

  @Default(0)
  @Column
  countEmbeddingTime: number;

  @Default(0)
  @Column(DataType.BIGINT)
  sumGenerationTimeMs: number;

  @Default(0)
  @Column
  countGenerationTime: number;

  @Default(0)
  @Column(DataType.FLOAT)
  sumKnowledgeScore: number;

  @Default(0)
  @Column
  countKnowledgeScore: number;

  @Default(0)
  @Column
  sumChunks: number;

  @Default(0)
  @Column
  sumContextTokens: number;

  @Default(0)
  @Column(DataType.BIGINT)
  estimatedTokensInput: number;

  @Default(0)
  @Column(DataType.BIGINT)
  estimatedTokensOutput: number;

  @AllowNull(true)
  @Column(DataType.JSON)
  providerUsage: Record<string, number> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  modelUsage: Record<string, number> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentAnalyticsDaily;
