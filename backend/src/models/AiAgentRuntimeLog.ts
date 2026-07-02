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
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentRuntimeLog;
