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
  tableName: "AutomationExecutionSteps",
  indexes: [
    {
      name: "AutomationExecutionSteps_company_exec_step_uq",
      unique: true,
      fields: ["companyId", "executionId", "stepIndex"]
    }
  ]
})
class AutomationExecutionStep extends Model<AutomationExecutionStep> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AutomationExecution)
  @Column
  executionId: number;

  @BelongsTo(() => AutomationExecution)
  execution: AutomationExecution;

  @Column
  stepIndex: number;

  @Column(DataType.STRING(64))
  actionName: string;

  @Default("pending")
  @Column(DataType.STRING(32))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  resultStatus: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  inputPreview: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  outputPreview: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  errorCode: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  errorMessage: string | null;

  @AllowNull(true)
  @Column
  durationMs: number | null;

  @AllowNull(true)
  @Column
  startedAt: Date | null;

  @AllowNull(true)
  @Column
  finishedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationExecutionStep;
