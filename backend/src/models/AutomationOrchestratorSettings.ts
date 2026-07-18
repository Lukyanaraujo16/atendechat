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
  tableName: "AutomationOrchestratorSettings",
  indexes: [
    {
      name: "AutomationOrchestratorSettings_scope_uq",
      unique: true,
      fields: ["companyId", "whatsappId", "aiAgentId"]
    },
    {
      name: "AutomationOrchestratorSettings_company_mode_idx",
      fields: ["companyId", "controlMode"]
    }
  ]
})
class AutomationOrchestratorSettings extends Model<AutomationOrchestratorSettings> {
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
  whatsappId: number | null;

  @AllowNull(true)
  @Column
  aiAgentId: number | null;

  @Default("observe")
  @Column(DataType.STRING(32))
  controlMode: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  capabilities: Record<string, string> | null;

  @Default(true)
  @Column
  enabled: boolean;

  @AllowNull(true)
  @Column
  circuitBreakerOpenUntil: Date | null;

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

export default AutomationOrchestratorSettings;
