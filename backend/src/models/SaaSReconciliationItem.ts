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
  DataType,
  AllowNull,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Invoices from "./Invoices";
import SaaSPayment from "./SaaSPayment";

@Table({ tableName: "SaaSReconciliationItems" })
class SaaSReconciliationItem extends Model<SaaSReconciliationItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Invoices)
  @AllowNull(true)
  @Column
  invoiceId: number | null;

  @ForeignKey(() => SaaSPayment)
  @AllowNull(true)
  @Column
  paymentId: number | null;

  @Column
  kind: string;

  @Default("pending")
  @Column
  status: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  message: string | null;

  @Default(0)
  @Column
  retryCount: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lastError: string | null;

  @AllowNull(true)
  @Column
  resolvedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSReconciliationItem;
