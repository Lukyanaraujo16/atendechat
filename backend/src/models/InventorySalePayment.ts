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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventorySale, { InventoryPaymentMethod } from "./InventorySale";
import User from "./User";

/** Status da linha de pagamento (não confundir com agregado da sale). */
export type InventorySalePaymentLineStatus = "pending" | "paid" | "reversed";

@Table({ tableName: "InventorySalePayments" })
class InventorySalePayment extends Model<InventorySalePayment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventorySale)
  @AllowNull(false)
  @Column
  saleId: number;

  @BelongsTo(() => InventorySale)
  sale: InventorySale;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  method: InventoryPaymentMethod;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  amount: string | number;

  @AllowNull(false)
  @Column(DataType.STRING(16))
  status: InventorySalePaymentLineStatus;

  @AllowNull(true)
  @Column(DataType.DATE)
  paidAt: Date | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  notes: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  cardInstallmentCount: number | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdByUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "createdByUserId", as: "createdByUser" })
  createdByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySalePayment;
