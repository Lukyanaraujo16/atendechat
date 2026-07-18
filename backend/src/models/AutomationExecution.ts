import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AutomationExecutionStep from "./AutomationExecutionStep";
import AutomationExecutionEvent from "./AutomationExecutionEvent";
import AutomationPlannerValidation from "./AutomationPlannerValidation";

@Table({
  tableName: "AutomationExecutions",
  indexes: [
    {
      name: "AutomationExecutions_company_channel_message_uq",
      unique: true,
      fields: ["companyId", "channel", "messageId"]
    }
  ]
})
class AutomationExecution extends Model<AutomationExecution> {
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
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column
  contactId: number | null;

  @AllowNull(true)
  @Column
  whatsappId: number | null;

  @Default("whatsapp")
  @Column(DataType.STRING(32))
  channel: string;

  @AllowNull(true)
  @Column(DataType.STRING(191))
  messageId: string | null;

  @Default("queued")
  @Column(DataType.STRING(32))
  status: string;

  @Default("observe")
  @Column(DataType.STRING(16))
  controlMode: string;

  @Default("2.0.0")
  @Column(DataType.STRING(32))
  plannerVersion: string;

  @AllowNull(true)
  @Column
  currentStep: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  intent: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  executionContext: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  plan: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  graph: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @Default("legacy")
  @Column(DataType.STRING(16))
  ownership: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  capabilitiesSnapshot: Record<string, string> | null;

  @Default(false)
  @Column
  fallbackToLegacy: boolean;

  @Default(false)
  @Column
  circuitBreakerTripped: boolean;

  @AllowNull(true)
  @Column
  plannerValidationId: number | null;

  @BelongsTo(() => AutomationPlannerValidation, {
    foreignKey: "plannerValidationId",
    constraints: false
  })
  plannerValidation: AutomationPlannerValidation;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  errorMessage: string | null;

  @AllowNull(true)
  @Column
  startedAt: Date | null;

  @AllowNull(true)
  @Column
  finishedAt: Date | null;

  @HasMany(() => AutomationExecutionStep)
  steps: AutomationExecutionStep[];

  @HasMany(() => AutomationExecutionEvent)
  events: AutomationExecutionEvent[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationExecution;
