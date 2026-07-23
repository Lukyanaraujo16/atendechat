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

@Table({
  tableName: "AutomationAgentOsMetrics",
  indexes: [
    {
      name: "AutomationAgentOsMetrics_company_module_key_period_uq",
      unique: true,
      fields: ["companyId", "moduleKey", "metricKey", "periodStart"]
    },
    { name: "AutomationAgentOsMetrics_company_created_idx", fields: ["companyId", "createdAt"] }
  ]
})
class AutomationAgentOsMetric extends Model<AutomationAgentOsMetric> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(64))
  moduleKey: string;

  @Column(DataType.STRING(96))
  metricKey: string;

  @Column(DataType.FLOAT)
  metricValue: number;

  @AllowNull(true)
  @Column(DataType.JSON)
  dimensions: Record<string, unknown> | null;

  @AllowNull(true)
  @Column
  periodStart: Date | null;

  @AllowNull(true)
  @Column
  periodEnd: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationAgentOsMetric;
