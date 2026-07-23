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
  tableName: "AutomationMcpCredentials",
  paranoid: true,
  indexes: [
    { name: "AutomationMcpCredentials_company_auth_idx", fields: ["companyId", "authType"] }
  ]
})
class AutomationMcpCredential extends Model<AutomationMcpCredential> {
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

  @Column(DataType.STRING(32))
  authType: string;

  @Column(DataType.TEXT)
  encryptedPayload: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  maskedPreview: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @AllowNull(true)
  @Column
  createdBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationMcpCredential;
