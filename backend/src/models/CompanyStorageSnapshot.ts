import {
  Table,
  Column,
  CreatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "CompanyStorageSnapshots" })
class CompanyStorageSnapshot extends Model<CompanyStorageSnapshot> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  usedBytes: number | string;

  @Column({ type: DataType.BIGINT, allowNull: true })
  limitBytes: number | string | null;

  @Column({ type: DataType.DECIMAL(10, 1), allowNull: true })
  usagePercent: string | number | null;

  /** manual_recalculate | scheduled_recalculate | media_increment | media_decrement | threshold_* */
  @Column({ type: DataType.STRING(64), allowNull: false })
  reason: string;

  @CreatedAt
  createdAt: Date;
}

export default CompanyStorageSnapshot;
