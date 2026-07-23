import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "AutomationAgentOsReplays",
  paranoid: true,
  indexes: [
    { name: "AutomationAgentOsReplays_company_module_idx", fields: ["companyId", "moduleKey"] },
    { name: "AutomationAgentOsReplays_company_session_idx", fields: ["companyId", "sessionId"] },
    { name: "AutomationAgentOsReplays_company_created_idx", fields: ["companyId", "createdAt"] }
  ]
})
class AutomationAgentOsReplay extends Model<AutomationAgentOsReplay> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(64))
  moduleKey: string;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  sourceId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  sessionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  agentId: string | null;

  @Column(DataType.JSON)
  payload: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationAgentOsReplay;
