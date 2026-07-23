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
  tableName: "AutomationAgentOsAudits",
  indexes: [
    { name: "AutomationAgentOsAudits_company_created_idx", fields: ["companyId", "createdAt"] },
    { name: "AutomationAgentOsAudits_company_agent_idx", fields: ["companyId", "agentId"] },
    { name: "AutomationAgentOsAudits_company_session_idx", fields: ["companyId", "sessionId"] },
    { name: "AutomationAgentOsAudits_company_module_idx", fields: ["companyId", "moduleKey"] }
  ]
})
class AutomationAgentOsAudit extends Model<AutomationAgentOsAudit> {
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

  @Column(DataType.STRING(64))
  action: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  agentId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  sessionId: string | null;

  @AllowNull(true)
  @Column
  userId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  previousState: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  newState: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  reasonCodes: unknown;

  @AllowNull(true)
  @Column(DataType.JSON)
  payloadSanitized: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationAgentOsAudit;
