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
import AiKnowledgeDocument from "./AiKnowledgeDocument";
import type {
  KnowledgeProcessingRecordStatus,
  KnowledgeProcessorName
} from "../config/knowledgeBaseConstants";

/**
 * Histórico imutável de processamentos de um documento.
 * Cada tentativa gera um novo registo — nunca sobrescrever.
 */
@Table({
  tableName: "AiKnowledgeDocumentProcessing",
  indexes: [
    {
      name: "AiKnowledgeDocumentProcessing_companyId_documentId_idx",
      fields: ["companyId", "knowledgeDocumentId"]
    },
    {
      name: "AiKnowledgeDocumentProcessing_companyId_status_idx",
      fields: ["companyId", "status"]
    }
  ]
})
class AiKnowledgeDocumentProcessing extends Model<AiKnowledgeDocumentProcessing> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiKnowledgeDocument)
  @Column
  knowledgeDocumentId: number;

  @BelongsTo(() => AiKnowledgeDocument)
  knowledgeDocument: AiKnowledgeDocument;

  @AllowNull(false)
  @Column(DataType.STRING(40))
  processor: KnowledgeProcessorName | string;

  @Default("queued")
  @Column(DataType.STRING(40))
  status: KnowledgeProcessingRecordStatus;

  @Default(1)
  @Column
  attempt: number;

  @AllowNull(true)
  @Column
  startedAt: Date | null;

  @AllowNull(true)
  @Column
  finishedAt: Date | null;

  @AllowNull(true)
  @Column
  durationMs: number | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorMessage: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  logs: Record<string, unknown>[] | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiKnowledgeDocumentProcessing;
