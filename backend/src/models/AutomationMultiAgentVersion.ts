import {
  AllowNull,
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
import AutomationMultiAgent from "./AutomationMultiAgent";

@Table({
  tableName: "AutomationMultiAgentVersions",
  indexes: [
    {
      name: "AutomationMultiAgentVersions_company_agent_version_uq",
      unique: true,
      fields: ["companyId", "agentId", "version"]
    }
  ]
})
class AutomationMultiAgentVersion extends Model<AutomationMultiAgentVersion> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AutomationMultiAgent)
  @Column(DataType.STRING(64))
  agentId: string;

  @BelongsTo(() => AutomationMultiAgent)
  agent: AutomationMultiAgent;

  @Column
  version: number;

  @Column(DataType.JSON)
  snapshot: Record<string, unknown>;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  changeSummary: string | null;

  @AllowNull(true)
  @Column
  changedBy: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationMultiAgentVersion;
