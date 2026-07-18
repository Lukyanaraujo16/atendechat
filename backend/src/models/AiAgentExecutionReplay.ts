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
  tableName: "AiAgentExecutionReplays",
  indexes: [
    {
      name: "AiAgentExecutionReplays_company_agent_created_idx",
      fields: ["companyId", "aiAgentId", "createdAt"]
    }
  ]
})
class AiAgentExecutionReplay extends Model<AiAgentExecutionReplay> {
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
  runtimeLogId: number | null;

  @AllowNull(true)
  @Column
  retrievalId: number | null;

  @AllowNull(true)
  @Column
  simulationSessionId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  requestId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  decision: string | null;

  @Default(false)
  @Column
  handoff: boolean;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  provider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  model: string | null;

  @AllowNull(true)
  @Column
  latencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(240))
  messagePreview: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  responsePreview: string | null;

  @Column(DataType.JSON)
  snapshot: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentExecutionReplay;
