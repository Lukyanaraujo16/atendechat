import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasOne,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import Company from "./Company";
import AiAgentSimulationSession from "./AiAgentSimulationSession";
import AiAgentSimulationMessageReview from "./AiAgentSimulationMessageReview";

@Table({
  tableName: "AiAgentSimulationMessages",
  updatedAt: false,
  indexes: [
    {
      name: "AiAgentSimulationMessages_session_createdAt_idx",
      fields: ["sessionId", "createdAt"]
    }
  ]
})
class AiAgentSimulationMessage extends Model<AiAgentSimulationMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgentSimulationSession)
  @Column
  sessionId: number;

  @BelongsTo(() => AiAgentSimulationSession)
  session: AiAgentSimulationSession;

  @Column(DataType.STRING(16))
  role: string;

  @Column(DataType.TEXT)
  content: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  provider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  model: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  promptTokens: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  completionTokens: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  totalTokens: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  latencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  handoffSuggested: boolean;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  handoffReason: string | null;

  @HasOne(() => AiAgentSimulationMessageReview)
  review: AiAgentSimulationMessageReview;

  @CreatedAt
  createdAt: Date;
}

export default AiAgentSimulationMessage;
