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
import User from "./User";
import AiProviderCredential from "./AiProviderCredential";

@Table({
  tableName: "AiKnowledgeEmbeddingSettings",
  indexes: [
    {
      name: "AiKnowledgeEmbeddingSettings_companyId_unique",
      unique: true,
      fields: ["companyId"]
    }
  ]
})
class AiKnowledgeEmbeddingSettings extends Model<AiKnowledgeEmbeddingSettings> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(true)
  @ForeignKey(() => AiProviderCredential)
  @Column
  credentialId: number | null;

  @BelongsTo(() => AiProviderCredential)
  credential: AiProviderCredential;

  @Default("openai")
  @Column(DataType.STRING(40))
  provider: string;

  @Default("text-embedding-3-small")
  @Column(DataType.STRING(120))
  model: string;

  @Default(1536)
  @Column
  dimensions: number;

  @Default(true)
  @Column
  enabled: boolean;

  @Default(800)
  @Column
  chunkSize: number;

  @Default(120)
  @Column
  chunkOverlap: number;

  @Default(40)
  @Column
  minChunkSize: number;

  @Default(16)
  @Column
  batchSize: number;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeEmbeddingSettings;
