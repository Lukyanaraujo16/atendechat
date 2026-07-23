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
  tableName: "AutomationMcpServers",
  paranoid: true,
  indexes: [
    {
      name: "AutomationMcpServers_company_slug_uq",
      unique: true,
      fields: ["companyId", "slug"]
    }
  ]
})
class AutomationMcpServer extends Model<AutomationMcpServer> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(255))
  name: string;

  @Column(DataType.STRING(128))
  slug: string;

  @Column(DataType.STRING(32))
  status: string;

  @Column(DataType.STRING(32))
  transport: string;

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

export default AutomationMcpServer;
