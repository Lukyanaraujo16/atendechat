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
  HasMany,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventoryReceivable from "./InventoryReceivable";
import InventoryReceivablePayment from "./InventoryReceivablePayment";

export type InventoryReceivableInstallmentStatus =
  | "open"
  | "partial"
  | "paid"
  | "cancelled";

@Table({
  tableName: "InventoryReceivableInstallments",
  indexes: [
    {
      unique: true,
      name: "InventoryReceivableInstallments_id_companyId_unique",
      fields: ["id", "companyId"]
    },
    {
      unique: true,
      name: "InventoryReceivableInstallments_company_recv_seq_uq",
      fields: ["companyId", "receivableId", "sequence"]
    },
    {
      name: "InventoryReceivableInstallments_company_due_status_idx",
      fields: ["companyId", "dueDate", "status"]
    },
    {
      name: "InventoryReceivableInstallments_company_status_idx",
      fields: ["companyId", "status"]
    }
  ]
})
class InventoryReceivableInstallment extends Model<InventoryReceivableInstallment> {
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

  @Column
  sequence: number;

  @Column(DataType.DATEONLY)
  dueDate: string;

  @Column(DataType.DECIMAL(12, 2))
  originalAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  paidAmount: string | number;

  @Column(DataType.DECIMAL(12, 2))
  openAmount: string | number;

  @Default("open")
  @Column(DataType.STRING(16))
  status: InventoryReceivableInstallmentStatus;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => InventoryReceivablePayment)
  payments: InventoryReceivablePayment[];
}

export default InventoryReceivableInstallment;
