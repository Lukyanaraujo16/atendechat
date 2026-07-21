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

@Table({
  tableName: "AutomationToolExecutions",
  indexes: [
    {
      name: "AutomationToolExecutions_company_tool_status_idx",
      fields: ["companyId", "toolId", "status"]
    },
    {
      name: "AutomationToolExecutions_company_created_idx",
      fields: ["companyId", "createdAt"]
    },
    {
      name: "AutomationToolExecutions_company_automation_idx",
      fields: ["companyId", "automationExecutionId"]
    },
    {
      name: "AutomationToolExecutions_company_ticket_idx",
      fields: ["companyId", "ticketId"]
    },
    {
      name: "AutomationToolExecutions_company_message_idx",
      fields: ["companyId", "messageId"]
    },
    {
      name: "AutomationToolExecutions_company_tool_idem_uq",
      unique: true,
      fields: ["companyId", "toolId", "idempotencyKey"]
    }
  ]
})
class AutomationToolExecution extends Model<AutomationToolExecution> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(128))
  toolId: string;

  @Column(DataType.STRING(32))
  toolVersion: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  category: string | null;

  @Column(DataType.STRING(32))
  source: string;

  @Column(DataType.STRING(32))
  riskLevel: string;

  @Column(DataType.STRING(32))
  sideEffectType: string;

  @Column(DataType.STRING(32))
  status: string;

  @Column(DataType.STRING(32))
  controlMode: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  executionOwner: string | null;

  @AllowNull(true)
  @Column
  automationExecutionId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  actionExecutionId: string | null;

  @AllowNull(true)
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column
  contactId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(191))
  messageId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  requestId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  correlationId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  idempotencyKey: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  inputSnapshot: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  outputSnapshot: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  errorSnapshot: Record<string, unknown> | null;

  @Default(0)
  @Column
  attemptCount: number;

  @AllowNull(true)
  @Column
  timeoutMs: number | null;

  @AllowNull(true)
  @Column
  durationMs: number | null;

  @Default("none")
  @Column(DataType.STRING(32))
  confirmationStatus: string;

  @Default(false)
  @Column
  sideEffectCommitted: boolean;

  @Default("none")
  @Column(DataType.STRING(32))
  rollbackStatus: string;

  @AllowNull(true)
  @Column
  startedAt: Date | null;

  @AllowNull(true)
  @Column
  finishedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationToolExecution;
