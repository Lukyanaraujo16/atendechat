import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AutomationMultiAgentVersion from "./AutomationMultiAgentVersion";

@Table({
  tableName: "AutomationMultiAgents",
  paranoid: true,
  indexes: [
    {
      name: "AutomationMultiAgents_company_slug_uq",
      unique: true,
      fields: ["companyId", "slug"]
    },
    { name: "AutomationMultiAgents_company_status_idx", fields: ["companyId", "status"] },
    { name: "AutomationMultiAgents_company_role_idx", fields: ["companyId", "role"] }
  ]
})
class AutomationMultiAgent extends Model<AutomationMultiAgent> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(128))
  slug: string;

  @Column(DataType.STRING(255))
  name: string;

  @Column(DataType.STRING(32))
  status: string;

  @Column(DataType.STRING(32))
  role: string;

  @Column(DataType.STRING(32))
  specialization: string;

  @Default(true)
  @Column
  enabled: boolean;

  @Default(1)
  @Column
  version: number;

  @Default(false)
  @Column
  isDefault: boolean;

  @Default(false)
  @Column
  isCoordinator: boolean;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @HasMany(() => AutomationMultiAgentVersion)
  versions: AutomationMultiAgentVersion[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationMultiAgent;
