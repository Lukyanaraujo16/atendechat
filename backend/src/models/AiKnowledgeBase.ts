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
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import AiKnowledgeDocument from "./AiKnowledgeDocument";

/**
 * Coleção lógica de conhecimento por empresa.
 * Relacionamento futuro com agentes: AiAgentKnowledgeBases (fase posterior).
 */
@Table({
  tableName: "AiKnowledgeBases",
  paranoid: true,
  indexes: [
    {
      name: "AiKnowledgeBases_companyId_enabled_idx",
      fields: ["companyId", "enabled"]
    },
    {
      name: "AiKnowledgeBases_companyId_deletedAt_idx",
      fields: ["companyId", "deletedAt"]
    }
  ]
})
class AiKnowledgeBase extends Model<AiKnowledgeBase> {
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
  @Column(DataType.STRING(160))
  name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string | null;

  @Default(true)
  @Column
  enabled: boolean;

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

  @DeletedAt
  deletedAt: Date | null;

  @HasMany(() => AiKnowledgeDocument)
  documents: AiKnowledgeDocument[];
}

export default AiKnowledgeBase;
