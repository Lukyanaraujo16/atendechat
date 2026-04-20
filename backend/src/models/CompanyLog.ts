import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

/** Auditoria de ações relevantes na empresa (Super Admin). */
@Table
class CompanyLog extends Model<CompanyLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  action: string;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number | null;

  @BelongsTo(() => User, { foreignKey: "userId", as: "user" })
  user: User;

  @Column(DataType.JSONB)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyLog;
