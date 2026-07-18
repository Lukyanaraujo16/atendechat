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
import AutomationExecution from "./AutomationExecution";

@Table({
  tableName: "AutomationPlannerValidations",
  indexes: [
    {
      name: "AutomationPlannerValidations_company_created_idx",
      fields: ["companyId", "createdAt"]
    },
    {
      name: "AutomationPlannerValidations_company_match_sev_idx",
      fields: ["companyId", "matched", "divergenceSeverity"]
    },
    {
      name: "AutomationPlannerValidations_company_message_idx",
      fields: ["companyId", "messageId"]
    }
  ]
})
class AutomationPlannerValidation extends Model<AutomationPlannerValidation> {
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
  whatsappId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(191))
  messageId: string | null;

  @AllowNull(true)
  @ForeignKey(() => AutomationExecution)
  @Column
  executionId: number | null;

  @BelongsTo(() => AutomationExecution)
  execution: AutomationExecution;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  plannedIntent: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  plannedActions: unknown[] | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  legacyIntent: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  legacyHandler: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  legacyResult: string | null;

  @Default(false)
  @Column
  matched: boolean;

  @Default("info")
  @Column(DataType.STRING(16))
  divergenceSeverity: string;

  @AllowNull(true)
  @Column(DataType.STRING(240))
  divergenceReason: string | null;

  @AllowNull(true)
  @Column
  processingTimeMs: number | null;

  @Default("legacy")
  @Column(DataType.STRING(16))
  ownership: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  controlMode: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationPlannerValidation;
