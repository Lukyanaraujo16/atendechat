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
  tableName: "AutomationMcpTools",
  paranoid: true,
  indexes: [
    {
      name: "AutomationMcpTools_company_server_name_uq",
      unique: true,
      fields: ["companyId", "serverId", "name"]
    }
  ]
})
class AutomationMcpTool extends Model<AutomationMcpTool> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(64))
  serverId: string;

  @Column(DataType.STRING(191))
  name: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  schemaHash: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationMcpTool;
