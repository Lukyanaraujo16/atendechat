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
  tableName: "AutomationAgentOsSettings",
  indexes: [
    {
      name: "AutomationAgentOsSettings_company_module_uq",
      unique: true,
      fields: ["companyId", "moduleKey"]
    }
  ]
})
class AutomationAgentOsSetting extends Model<AutomationAgentOsSetting> {
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

  @Column(DataType.JSON)
  config: Record<string, unknown>;

  @Default(1)
  @Column
  version: number;

  @AllowNull(true)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationAgentOsSetting;
