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
  tableName: "AiKnowledgeSuggestions",
  indexes: [
    {
      name: "AiKnowledgeSuggestions_company_status_created_idx",
      fields: ["companyId", "status", "createdAt"]
    }
  ]
})
class AiKnowledgeSuggestion extends Model<AiKnowledgeSuggestion> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(true)
  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number | null;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @AllowNull(true)
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column
  runtimeLogId: number | null;

  @AllowNull(true)
  @Column
  knowledgeGapId: number | null;

  @Column(DataType.STRING(32))
  origin: string;

  @Default("pending")
  @Column(DataType.STRING(32))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(240))
  questionPreview: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  aiReplyPreview: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  humanReplyPreview: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  differenceSummary: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  reason: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @Column
  reviewedBy: number | null;

  @AllowNull(true)
  @Column
  reviewedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeSuggestion;
