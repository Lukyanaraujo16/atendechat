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
import {
  AI_AGENT_GENERATED_PROMPT_VERSION,
  AI_AGENT_PROFILE_SCHEMA_VERSION
} from "../config/aiAgentProfileConfig";

export type AiAgentProfileFaqItem = {
  question: string;
  answer: string;
};

@Table({
  tableName: "AiAgentProfiles",
  indexes: [
    {
      name: "AiAgentProfiles_company_agent_uq",
      unique: true,
      fields: ["companyId", "aiAgentId"]
    }
  ]
})
class AiAgentProfile extends Model<AiAgentProfile> {
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

  @Default(AI_AGENT_PROFILE_SCHEMA_VERSION)
  @Column
  schemaVersion: number;

  @Default("guided")
  @AllowNull(false)
  @Column(DataType.STRING(16))
  setupMode: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  companyName: string;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  businessSegment: string;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  customBusinessSegment: string | null;

  @AllowNull(false)
  @Column(DataType.JSON)
  departments: string[];

  @AllowNull(false)
  @Column(DataType.STRING(100))
  attendantName: string;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  attendantRole: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  tone: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  customTone: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  clientAddressStyle: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(16))
  emojiLevel: string;

  @AllowNull(false)
  @Column(DataType.STRING(16))
  responseLength: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  allowedActions: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  forbiddenActions: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  handoffRules: string[] | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  companyDescription: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  productsAndServices: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  serviceArea: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  businessHours: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  pricingPolicy: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  negotiationPolicy: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  schedulingPolicy: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  frequentlyAskedQuestions: AiAgentProfileFaqItem[] | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  importantInformation: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  customInstructions: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  sourceWebsite: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  generatedPrompt: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(16))
  generatedPromptVersion: string | null;

  @AllowNull(true)
  @Column
  generatedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentProfile;
