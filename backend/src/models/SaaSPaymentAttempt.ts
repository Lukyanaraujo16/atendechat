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

@Table({ tableName: "SaaSPaymentAttempts" })
class SaaSPaymentAttempt extends Model<SaaSPaymentAttempt> {
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

  @Column
  method: string;

  @Default("pending")
  @Column
  status: string;

  @AllowNull(true)
  @Column
  externalTxid: string | null;

  @AllowNull(true)
  @Column
  externalChargeId: string | null;

  @AllowNull(true)
  @Column
  gatewayProvider: string | null;

  @AllowNull(true)
  @Column
  gatewayStatus: string | null;

  @AllowNull(true)
  @Column(DataType.DECIMAL(12, 2))
  amount: number | string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payloadSummary: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorMessage: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSPaymentAttempt;
