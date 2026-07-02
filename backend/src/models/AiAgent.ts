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
import {
  DEFAULT_AI_AGENT_MAX_TOKENS,
  DEFAULT_AI_AGENT_MODEL,
  DEFAULT_AI_AGENT_TEMPERATURE
} from "../config/aiAgentDefaults";

@Table({
  tableName: "AiAgents",
  indexes: [
    {
      name: "AiAgents_companyId_enabled_idx",
      fields: ["companyId", "enabled"]
    }
  ]
})
class AiAgent extends Model<AiAgent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string | null;

  @Default(false)
  @Column
  enabled: boolean;

  @Default(DEFAULT_AI_AGENT_MODEL)
  @Column(DataType.STRING(64))
  model: string;

  @Default(DEFAULT_AI_AGENT_TEMPERATURE)
  @Column(DataType.FLOAT)
  temperature: number;

  @Default(DEFAULT_AI_AGENT_MAX_TOKENS)
  @Column
  maxTokens: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  systemPrompt: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  fallbackMessage: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  handoffMessage: string | null;

  @Default(false)
  @Column
  allowAudioInput: boolean;

  @Default(false)
  @Column
  allowAudioOutput: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgent;
