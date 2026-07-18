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
import AiKnowledgeBase from "./AiKnowledgeBase";
import AiKnowledgeDocument from "./AiKnowledgeDocument";

@Table({
  tableName: "AiKnowledgeDocumentStats",
  indexes: [
    {
      name: "AiKnowledgeDocumentStats_company_document_uq",
      unique: true,
      fields: ["companyId", "documentId"]
    }
  ]
})
class AiKnowledgeDocumentStats extends Model<AiKnowledgeDocumentStats> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiKnowledgeBase)
  @Column
  knowledgeBaseId: number;

  @BelongsTo(() => AiKnowledgeBase)
  knowledgeBase: AiKnowledgeBase;

  @ForeignKey(() => AiKnowledgeDocument)
  @Column
  documentId: number;

  @BelongsTo(() => AiKnowledgeDocument)
  document: AiKnowledgeDocument;

  @Default(0)
  @Column
  retrievalCount: number;

  @Default(0)
  @Column
  top1Count: number;

  @Default(0)
  @Column(DataType.FLOAT)
  sumScore: number;

  @Default(0)
  @Column(DataType.FLOAT)
  sumRank: number;

  @Default(0)
  @Column
  scoreSamples: number;

  @Default(0)
  @Column
  sumChunksReturned: number;

  @Default(0)
  @Column
  retrievalFailures: number;

  @AllowNull(true)
  @Column
  lastRetrievedAt: Date | null;

  @AllowNull(true)
  @Column
  lastUsedByAgentId: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeDocumentStats;
