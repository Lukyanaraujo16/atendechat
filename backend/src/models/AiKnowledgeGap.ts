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
  tableName: "AiKnowledgeGaps",
  indexes: [
    {
      name: "AiKnowledgeGaps_company_agent_hash_reason_uq",
      unique: true,
      fields: ["companyId", "aiAgentId", "questionHash", "reason"]
    }
  ]
})
class AiKnowledgeGap extends Model<AiKnowledgeGap> {
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

  @AllowNull(true)
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column
  simulationId: number | null;

  @Column(DataType.STRING(32))
  channel: string;

  @Column(DataType.STRING(240))
  questionPreview: string;

  @Column(DataType.STRING(64))
  questionHash: string;

  @Column(DataType.STRING(32))
  knowledgeStatus: string;

  @Column(DataType.STRING(64))
  reason: string;

  @Default(1)
  @Column
  frequency: number;

  @Column
  firstSeenAt: Date;

  @Column
  lastSeenAt: Date;

  @Default(false)
  @Column
  resolved: boolean;

  @Default("open")
  @Column(DataType.STRING(32))
  resolutionStatus: string;

  @AllowNull(true)
  @Column
  resolvedDocumentId: number | null;

  @AllowNull(true)
  @Column
  resolvedAt: Date | null;

  @AllowNull(true)
  @Column
  resolvedBy: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeGap;
