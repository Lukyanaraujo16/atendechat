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
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import Invoices from "./Invoices";
import SaaSPayment from "./SaaSPayment";
import User from "./User";

@Table({ tableName: "SaaSSubscriptionRenewals" })
class SaaSSubscriptionRenewal extends Model<SaaSSubscriptionRenewal> {
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

  /** payment_confirmed | manual_renew | courtesy | due_date_adjustment */
  @Column
  reason: string;

  @AllowNull(true)
  @Column
  previousDueDate: string | null;

  @Column
  newDueDate: string;

  @AllowNull(true)
  @Column
  recurrence: string | null;

  @Column
  monthsAdded: number;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  actorUserId: number | null;

  @AllowNull(true)
  @Column
  idempotencyKey: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSSubscriptionRenewal;
