import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  DefaultScope,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

/**
 * Credenciais Evolution por conexão.
 * Default scope exclui apiKeyEncrypted de serializações acidentais.
 */
@DefaultScope(() => ({
  attributes: {
    exclude: ["apiKeyEncrypted"]
  }
}))
@Table({
  tableName: "WhatsappEvolutionCredentials",
  indexes: [
    {
      name: "WhatsappEvolutionCredentials_companyId_idx",
      fields: ["companyId"]
    }
  ]
})
/* eslint-disable no-use-before-define */
class WhatsappEvolutionCredential extends Model<WhatsappEvolutionCredential> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Column(DataType.STRING(512))
  baseUrl: string;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  instanceName: string;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  instanceId: string | null;

  @AllowNull(false)
  @Column(DataType.TEXT)
  apiKeyEncrypted: string;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  apiKeyMasked: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappEvolutionCredential;
