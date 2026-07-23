import {
  AllowNull,
  AutoIncrement,
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
  tableName: "AutomationAgentOsDocuments",
  paranoid: true,
  indexes: [
    {
      name: "AutomationAgentOsDocuments_company_type_key_uq",
      unique: true,
      fields: ["companyId", "entityType", "entityKey"]
    },
    {
      name: "AutomationAgentOsDocuments_company_type_created_idx",
      fields: ["companyId", "entityType", "createdAt"]
    },
    {
      name: "AutomationAgentOsDocuments_company_session_idx",
      fields: ["companyId", "sessionId"]
    },
    {
      name: "AutomationAgentOsDocuments_company_agent_idx",
      fields: ["companyId", "agentId"]
    }
  ]
})
class AutomationAgentOsDocument extends Model<AutomationAgentOsDocument> {
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
  entityType: string;

  @Column(DataType.STRING(128))
  entityKey: string;

  @Default(1)
  @Column
  version: number;

  @Column(DataType.JSON)
  payload: Record<string, unknown>;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  status: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  agentId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  sessionId: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationAgentOsDocument;
