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
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import InventoryCustomer from "./InventoryCustomer";
import InventorySale from "./InventorySale";
import InventoryReceivableInstallment from "./InventoryReceivableInstallment";
import InventoryReceivablePayment from "./InventoryReceivablePayment";

export type InventoryReceivableOriginType = "store_credit";
export type InventoryReceivableStatus =
  | "open"
  | "partial"
  | "paid"
  | "cancelled";
export type InventoryStoreCreditFrequency =
  | "once"
  | "weekly"
  | "biweekly"
  | "monthly";

@Table({
  tableName: "InventoryReceivables",
  indexes: [
    {
      unique: true,
      name: "InventoryReceivables_id_companyId_unique",
      fields: ["id", "companyId"]
    },
    {
      name: "InventoryReceivables_company_customer_status_idx",
      fields: ["companyId", "customerId", "status"]
    },
    {
      name: "InventoryReceivables_company_sale_idx",
      fields: ["companyId", "saleId"]
    },
    {
      name: "InventoryReceivables_company_status_idx",
      fields: ["companyId", "status"]
    }
  ]
})
class InventoryReceivable extends Model<InventoryReceivable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventoryCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => InventoryCustomer)
  customer: InventoryCustomer;

  @AllowNull
  @ForeignKey(() => InventorySale)
  @Column
  saleId: number | null;

  @BelongsTo(() => InventorySale)
  sale: InventorySale;

  @Default("store_credit")
  @Column(DataType.STRING(32))
  originType: InventoryReceivableOriginType;

  @Column(DataType.DECIMAL(12, 2))
  originalAmount: string | number;

  @Column(DataType.DECIMAL(12, 2))
  openAmount: string | number;

  @Default("open")
  @Column(DataType.STRING(16))
  status: InventoryReceivableStatus;

  @AllowNull
  @Column(DataType.STRING(16))
  scheduleFrequency: InventoryStoreCreditFrequency | null;

  @AllowNull
  @Column(DataType.INTEGER)
  installmentCount: number | null;

  @AllowNull
  @Column(DataType.DATEONLY)
  firstDueDate: string | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  createdByUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "createdByUserId", as: "createdByUser" })
  createdByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => InventoryReceivableInstallment)
  installments: InventoryReceivableInstallment[];

  @HasMany(() => InventoryReceivablePayment)
  payments: InventoryReceivablePayment[];
}

export default InventoryReceivable;
