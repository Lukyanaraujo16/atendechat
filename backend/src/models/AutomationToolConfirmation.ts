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

/**
 * Estado de confirmação para Tools futuras de escrita.
 * Sem UI operacional nesta fase — apenas contrato/persistência.
 */
@Table({
  tableName: "AutomationToolConfirmations",
  indexes: [
    {
      name: "AutomationToolConfirmations_company_status_idx",
      fields: ["companyId", "status"]
    },
    {
      name: "AutomationToolConfirmations_company_tool_exec_idx",
      fields: ["companyId", "toolExecutionId"]
    }
  ]
})
class AutomationToolConfirmation extends Model<AutomationToolConfirmation> {
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
  toolExecutionId: number | null;

  @Column(DataType.STRING(128))
  toolId: string;

  @Column(DataType.STRING(32))
  toolVersion: string;

  @Default("pending")
  @Column(DataType.STRING(32))
  status: string;

  @Default("policy_based")
  @Column(DataType.STRING(32))
  policy: string;

  @AllowNull(true)
  @Column
  requestedBy: number | null;

  @AllowNull(true)
  @Column
  resolvedBy: number | null;

  @AllowNull(true)
  @Column
  resolvedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationToolConfirmation;
