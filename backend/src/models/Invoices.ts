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
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "Invoices" })
class Invoices extends Model<Invoices> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  detail: string;

  @Column
  status: string;

  @Column
  value: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  dueDate: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** YYYY-MM competência */
  @AllowNull(true)
  @Column
  competence: string | null;

  /** Chave de ciclo única por empresa (ex.: 2026-10) */
  @AllowNull(true)
  @Column
  cycleKey: string | null;

  @AllowNull(true)
  @Column
  planIdSnapshot: number | null;

  @AllowNull(true)
  @Column
  planNameSnapshot: string | null;

  @AllowNull(true)
  @Column
  recurrenceSnapshot: string | null;

  @AllowNull(true)
  @Column
  paidAt: Date | null;

  @AllowNull(true)
  @Column
  cancelledAt: Date | null;

  /** gateway | paid_offline | courtesy | legacy_unknown */
  @AllowNull(true)
  @Column
  paymentSource: string | null;

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

  /** synced | pending | failed | unsupported | none */
  @AllowNull(true)
  @Column
  gatewaySyncStatus: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  gatewaySyncError: string | null;

  @Default(false)
  @Column
  legacyUnknown: boolean;
}

export default Invoices;
