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
import Ticket from "./Ticket";
import Whatsapp from "./Whatsapp";
import AiAgentRuntimeLog from "./AiAgentRuntimeLog";

@Table({
  tableName: "AiAgentShadowEvaluations",
  indexes: [
    {
      name: "AiAgentShadowEvaluations_company_createdAt_idx",
      fields: ["companyId", "createdAt"]
    },
    {
      name: "AiAgentShadowEvaluations_runtimeLog_idx",
      fields: ["runtimeLogId"]
    },
    {
      name: "AiAgentShadowEvaluations_company_status_idx",
      fields: ["companyId", "status"]
    }
  ]
})
class AiAgentShadowEvaluation extends Model<AiAgentShadowEvaluation> {
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
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number | null;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @AllowNull(true)
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number | null;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => AiAgentRuntimeLog)
  @Column
  runtimeLogId: number;

  @BelongsTo(() => AiAgentRuntimeLog)
  runtimeLog: AiAgentRuntimeLog;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  messageId: string | null;

  @AllowNull(true)
  @Column
  contactId: number | null;

  @Default("queued")
  @Column(DataType.STRING(24))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  provider: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  model: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  officialReply: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  shadowReply: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  systemPrompt: string | null;

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
  @Column(DataType.INTEGER)
  providerLatencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  toolLatencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  estimatedCostUsd: number | null;

  @Default(0)
  @Column
  toolCallCount: number;

  @Default(0)
  @Column
  loopCount: number;

  @Default(false)
  @Column
  usedTools: boolean;

  @Default(false)
  @Column
  usedKnowledge: boolean;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  loopStopReason: string | null;

  /** Selection, allowlist, provider payload, iterations, diffs. */
  @AllowNull(true)
  @Column(DataType.JSON)
  trace: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  comparison: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  toolAnalytics: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  knowledgeMeta: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentShadowEvaluation;
