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
import User from "./User";
import AiAgent from "./AiAgent";
import {
  AI_AGENT_KNOWLEDGE_DEFAULTS
} from "../config/aiAgentKnowledgeConstants";

@Table({
  tableName: "AiAgentKnowledgeSettings",
  indexes: [
    {
      name: "AiAgentKnowledgeSettings_company_agent_unique",
      unique: true,
      fields: ["companyId", "aiAgentId"]
    }
  ]
})
class AiAgentKnowledgeSettings extends Model<AiAgentKnowledgeSettings> {
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

  @Default(false)
  @Column
  enabled: boolean;

  @Default(false)
  @Column
  enabledInSimulator: boolean;

  @Default(false)
  @Column
  enabledInShadow: boolean;

  @Default(false)
  @Column
  enabledInLive: boolean;

  @Default(false)
  @Column
  functionCallingShadow: boolean;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.topK)
  @Column
  topK: number;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.minimumScore)
  @Column(DataType.FLOAT)
  minimumScore: number;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextCharacters)
  @Column
  maxContextCharacters: number;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextTokens)
  @Column
  maxContextTokens: number;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerDocument)
  @Column
  maxChunksPerDocument: number;

  @Default(AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerBase)
  @Column
  maxChunksPerBase: number;

  @Default(true)
  @Column
  includeSourcesInInternalMetadata: boolean;

  @Default(true)
  @Column
  allowAnswerWithoutKnowledge: boolean;

  @Default(false)
  @Column
  handoffWhenKnowledgeMissing: boolean;

  @AllowNull(true)
  @Column(DataType.JSON)
  documentTypes: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  languages: string[] | null;

  @Default("semantic")
  @Column(DataType.STRING(32))
  retrievalMode: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentKnowledgeSettings;
