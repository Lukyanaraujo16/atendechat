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
import User from "./User";

@Table({ tableName: "SaaSPayments" })
class SaaSPayment extends Model<SaaSPayment> {
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

  @BelongsTo(() => Invoices)
  invoice: Invoices;

  @Column(DataType.DECIMAL(12, 2))
  amount: number | string;

  @Column
  method: string;

  /** gateway | paid_offline | courtesy | admin_adjustment | historical_payment | historical_courtesy — cortesia não é receita */
  @Column
  source: string;

  @Default(true)
  @Column
  countsAsRevenue: boolean;

  /**
   * Data real do pagamento. NULL somente em pagamento histórico com data desconhecida
   * (`metadata.paidAtUnknown=true`) — Fase 8.4-F. Nunca inventar data.
   */
  @AllowNull(true)
  @Column
  paidAt: Date | null;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  recordedByUserId: number | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  reason: string | null;

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
  gatewaySyncStatus: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  gatewaySyncError: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSPayment;
