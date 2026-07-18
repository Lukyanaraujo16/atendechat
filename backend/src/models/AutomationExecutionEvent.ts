import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AutomationExecution from "./AutomationExecution";

@Table({
  tableName: "AutomationExecutionEvents",
  indexes: [
    {
      name: "AutomationExecutionEvents_company_exec_created_idx",
      fields: ["companyId", "executionId", "createdAt"]
    }
  ]
})
class AutomationExecutionEvent extends Model<AutomationExecutionEvent> {
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

  @AllowNull(true)
  @Column
  stepId: number | null;

  @Column(DataType.STRING(64))
  eventName: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationExecutionEvent;
