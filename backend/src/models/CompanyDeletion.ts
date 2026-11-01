import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType
} from "sequelize-typescript";

export type CompanyDeletionStatus =
  | "pending"
  | "running"
  | "failed"
  | "completed";
export type CompanyDeletionPhase =
  | "integrations"
  | "files_inventory"
  | "archive"
  | "database"
  | "files"
  | "done";

/** Acompanhamento da exclusão definitiva; sem FK para Companies (sobrevive à exclusão). */
@Table({ tableName: "CompanyDeletions" })
class CompanyDeletion extends Model<CompanyDeletion> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  companyName: string | null;

  @Column
  requestedBy: number | null;

  @Column(DataType.STRING(16))
  status: CompanyDeletionStatus;

  @Column(DataType.STRING(32))
  phase: CompanyDeletionPhase;

  @Column
  attempts: number;

  /** Alvos físicos absolutos definidos antes da fase de banco (o que restar ainda será removido). */
  @Column(DataType.JSONB)
  filePaths: Array<{ kind: "file" | "dir"; path: string }> | null;

  @Column(DataType.JSONB)
  stats: Record<string, unknown>;

  @Column(DataType.TEXT)
  lastError: string | null;

  @Column
  startedAt: Date | null;

  @Column
  finishedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyDeletion;
