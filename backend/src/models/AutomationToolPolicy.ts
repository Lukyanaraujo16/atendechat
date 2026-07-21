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
 * Política de Tools por empresa — deny-by-default.
 */
@Table({
  tableName: "AutomationToolPolicies",
  indexes: [
    {
      name: "AutomationToolPolicies_company_uq",
      unique: true,
      fields: ["companyId"]
    }
  ]
})
class AutomationToolPolicy extends Model<AutomationToolPolicy> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default(false)
  @Column
  enabled: boolean;

  @Default("read_only")
  @Column(DataType.STRING(32))
  maxRiskLevel: string;

  @Default(false)
  @Column
  allowWrite: boolean;

  @AllowNull(true)
  @Column(DataType.JSON)
  requireConfirmationFor: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  deniedToolIds: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  allowedToolIds: string[] | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationToolPolicy;
