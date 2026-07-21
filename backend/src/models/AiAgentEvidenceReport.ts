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
import Whatsapp from "./Whatsapp";
import AiAgentShadowEvaluation from "./AiAgentShadowEvaluation";

@Table({
  tableName: "AiAgentEvidenceReports",
  indexes: [
    {
      name: "AiAgentEvidenceReports_company_createdAt_idx",
      fields: ["companyId", "createdAt"]
    },
    {
      name: "AiAgentEvidenceReports_shadowEvaluation_idx",
      fields: ["shadowEvaluationId"],
      unique: true
    },
    {
      name: "AiAgentEvidenceReports_company_primaryType_idx",
      fields: ["companyId", "primaryType"]
    }
  ]
})
class AiAgentEvidenceReport extends Model<AiAgentEvidenceReport> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgentShadowEvaluation)
  @Column
  shadowEvaluationId: number;

  @BelongsTo(() => AiAgentShadowEvaluation)
  shadowEvaluation: AiAgentShadowEvaluation;

  @AllowNull(true)
  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number | null;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @AllowNull(true)
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number | null;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  provider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  model: string | null;

  @Column(DataType.STRING(48))
  primaryType: string;

  @Default(false)
  @Column
  verified: boolean;

  @Default(false)
  @Column
  hallucination: boolean;

  @Default(false)
  @Column
  knowledgeVerified: boolean;

  @Default(false)
  @Column
  knowledgeUnused: boolean;

  @Default(false)
  @Column
  emptyResult: boolean;

  @Default(false)
  @Column
  toolUnused: boolean;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  latencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  totalTokens: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  estimatedCostUsd: number | null;

  @Default(0)
  @Column
  toolCallCount: number;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  loopStopReason: string | null;

  /** EvidenceReport completo. */
  @Column(DataType.JSON)
  report: Record<string, unknown>;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentEvidenceReport;
