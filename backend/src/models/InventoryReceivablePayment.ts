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
import User from "./User";
import InventoryReceivable from "./InventoryReceivable";
import InventoryReceivableInstallment from "./InventoryReceivableInstallment";

@Table({
  tableName: "InventoryReceivablePayments",
  indexes: [
    {
      unique: true,
      name: "InventoryReceivablePayments_id_companyId_unique",
      fields: ["id", "companyId"]
    },
    {
      name: "InventoryReceivablePayments_company_recv_paidAt_idx",
      fields: ["companyId", "receivableId", "paidAt"]
    },
    {
      name: "InventoryReceivablePayments_company_installment_idx",
      fields: ["companyId", "installmentId"]
    },
    {
      name: "InventoryReceivablePayments_company_paidAt_idx",
      fields: ["companyId", "paidAt"]
    }
  ]
})
class InventoryReceivablePayment extends Model<InventoryReceivablePayment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventoryReceivable)
  @Column
  receivableId: number;

  @BelongsTo(() => InventoryReceivable)
  receivable: InventoryReceivable;

  @ForeignKey(() => InventoryReceivableInstallment)
  @Column
  installmentId: number;

  @BelongsTo(() => InventoryReceivableInstallment)
  installment: InventoryReceivableInstallment;

  @Column(DataType.DECIMAL(12, 2))
  amount: string | number;

  @Column(DataType.STRING(32))
  paymentMethod: string;

  @Column(DataType.DATE)
  paidAt: Date;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  createdByUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "createdByUserId", as: "createdByUser" })
  createdByUser: User;

  @AllowNull
  @Column(DataType.DATE)
  reversedAt: Date | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  reversedByUserId: number | null;

  @BelongsTo(() => User, {
    foreignKey: "reversedByUserId",
    as: "reversedByUser"
  })
  reversedByUser: User;

  @AllowNull
  @ForeignKey(() => InventoryReceivablePayment)
  @Column
  reverseOfPaymentId: number | null;

  @BelongsTo(() => InventoryReceivablePayment, {
    foreignKey: "reverseOfPaymentId",
    as: "reverseOfPayment"
  })
  reverseOfPayment: InventoryReceivablePayment;

  @AllowNull
  @Column(DataType.TEXT)
  reverseReason: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryReceivablePayment;
