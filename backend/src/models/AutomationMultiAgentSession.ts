import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "AutomationMultiAgentSessions",
  paranoid: true,
  indexes: [
    { name: "AutomationMultiAgentSessions_company_agent_idx", fields: ["companyId", "agentId"] },
    { name: "AutomationMultiAgentSessions_company_root_idx", fields: ["companyId", "rootSessionId"] },
    { name: "AutomationMultiAgentSessions_company_status_idx", fields: ["companyId", "status"] }
  ]
})
class AutomationMultiAgentSession extends Model<AutomationMultiAgentSession> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(64))
  rootSessionId: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  parentSessionId: string | null;

  @Column(DataType.STRING(64))
  agentId: string;

  @AllowNull(true)
  @Column
  agentVersion: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  supervisorAgentId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  delegatedByAgentId: string | null;

  @Default(0)
  @Column
  delegationDepth: number;

  @Default(0)
  @Column
  handoffCount: number;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  routingDecisionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  contextBoundaryId: string | null;

  @Column(DataType.STRING(64))
  status: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationMultiAgentSession;
