import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AiAgent from "./AiAgent";
import User from "./User";
import AiAgentSimulationMessage from "./AiAgentSimulationMessage";

@Table({
  tableName: "AiAgentSimulationSessions",
  updatedAt: true,
  indexes: [
    {
      name: "AiAgentSimulationSessions_company_agent_createdAt_idx",
      fields: ["companyId", "aiAgentId", "createdAt"]
    },
    {
      name: "AiAgentSimulationSessions_company_agent_status_idx",
      fields: ["companyId", "aiAgentId", "status"]
    }
  ]
})
class AiAgentSimulationSession extends Model<AiAgentSimulationSession> {
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

  @ForeignKey(() => User)
  @Column
  createdBy: number;

  @BelongsTo(() => User)
  creator: User;

  @Column(DataType.STRING(16))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  provider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  model: string | null;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  messageCount: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  totalPromptTokens: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  totalCompletionTokens: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  totalTokens: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  totalLatencyMs: number;

  @Column(DataType.DATE)
  startedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  endedAt: Date | null;

  @HasMany(() => AiAgentSimulationMessage)
  messages: AiAgentSimulationMessage[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentSimulationSession;
