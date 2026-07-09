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
import Ticket from "./Ticket";
import Contact from "./Contact";
import Whatsapp from "./Whatsapp";
import AiAgent from "./AiAgent";

@Table({
  tableName: "AiAgentRuntimeLogs",
  indexes: [
    {
      name: "AiAgentRuntimeLogs_companyId_createdAt_idx",
      fields: ["companyId", "createdAt"]
    },
    {
      name: "AiAgentRuntimeLogs_ticketId_createdAt_idx",
      fields: ["ticketId", "createdAt"]
    },
    {
      name: "AiAgentRuntimeLogs_aiAgentId_createdAt_idx",
      fields: ["aiAgentId", "createdAt"]
    },
    {
      name: "AiAgentRuntimeLogs_idempotency_uq",
      unique: true,
      fields: ["companyId", "whatsappId", "channel", "messageId"]
    },
    {
      name: "AiAgentRuntimeLogs_company_shadowStatus_createdAt_idx",
      fields: ["companyId", "shadowStatus", "createdAt"]
    },
    {
      name: "AiAgentRuntimeLogs_company_shadowProvider_createdAt_idx",
      fields: ["companyId", "shadowProvider", "createdAt"]
    }
  ]
})
class AiAgentRuntimeLog extends Model<AiAgentRuntimeLog> {
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
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number | null;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @AllowNull(true)
  @ForeignKey(() => Contact)
  @Column
  contactId: number | null;

  @BelongsTo(() => Contact)
  contact: Contact;

  @AllowNull(true)
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number | null;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(true)
  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number | null;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @Default("whatsapp")
  @Column(DataType.STRING(32))
  channel: string;

  @Default("dry_run")
  @Column(DataType.STRING(32))
  mode: string;

  @Default(false)
  @Column
  eligible: boolean;

  @Column(DataType.STRING(64))
  reason: string;

  @AllowNull(true)
  @Column(DataType.STRING(191))
  messageId: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @Default("not_requested")
  @Column(DataType.STRING(32))
  shadowStatus: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  suggestedReply: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  shadowModel: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  shadowProvider: string | null;

  @AllowNull(true)
  @Column
  promptTokens: number | null;

  @AllowNull(true)
  @Column
  completionTokens: number | null;

  @AllowNull(true)
  @Column
  totalTokens: number | null;

  @AllowNull(true)
  @Column
  latencyMs: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @AllowNull(true)
  @Column
  generatedAt: Date | null;

  @AllowNull(true)
  @Column
  contextMessageCount: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  contextHash: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  suggestionSource: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentRuntimeLog;
