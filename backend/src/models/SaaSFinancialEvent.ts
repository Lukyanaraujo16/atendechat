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
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import Invoices from "./Invoices";
import SaaSPayment from "./SaaSPayment";
import User from "./User";

@Table({ tableName: "SaaSFinancialEvents" })
class SaaSFinancialEvent extends Model<SaaSFinancialEvent> {
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
  eventType: string;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  actorUserId: number | null;

  @AllowNull(true)
  @Column
  idempotencyKey: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSFinancialEvent;
