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
  tableName: "AiProviderCredentials",
  indexes: [
    {
      name: "AiProviderCredentials_companyId_enabled_idx",
      fields: ["companyId", "enabled"]
    },
    {
      name: "AiProviderCredentials_companyId_isDefault_idx",
      fields: ["companyId", "isDefault"]
    }
  ]
})
class AiProviderCredential extends Model<AiProviderCredential> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  name: string;

  @AllowNull(false)
  @Default("openai")
  @Column(DataType.STRING(32))
  provider: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  apiKeyEncrypted: string;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  apiKeyMasked: string;

  @Default(true)
  @Column
  enabled: boolean;

  @Default(false)
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiProviderCredential;
