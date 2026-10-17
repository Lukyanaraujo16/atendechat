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
import User from "./User";

/**
 * Fase 8.4-F — decisão de regularização histórica de uma fatura.
 * decision: historical_payment | improper_cancel | historical_courtesy | keep_pending.
 * No máximo uma decisão terminal (≠ keep_pending) por fatura (índice único parcial).
 */
@Table({ tableName: "SaaSInvoiceHistoricalReviews" })
class SaaSInvoiceHistoricalReview extends Model<SaaSInvoiceHistoricalReview> {
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
  @Column
  invoiceId: number;

  @BelongsTo(() => Invoices)
  invoice: Invoices;

  @Column(DataType.STRING(32))
  decision: string;

  @Column(DataType.TEXT)
  note: string;

  @AllowNull(true)
  @Column
  confirmationSource: string | null;

  @AllowNull(true)
  @Column
  paidAt: Date | null;

  @Default(false)
  @Column
  paidAtUnknown: boolean;

  @AllowNull(true)
  @Column(DataType.DECIMAL(12, 2))
  amount: number | string | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  method: string | null;

  @ForeignKey(() => SaaSPayment)
  @AllowNull(true)
  @Column
  paymentId: number | null;

  @BelongsTo(() => SaaSPayment)
  payment: SaaSPayment;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  actorUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "actorUserId", as: "actor" })
  actor: User;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSInvoiceHistoricalReview;
