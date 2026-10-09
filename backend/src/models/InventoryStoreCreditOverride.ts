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
import User from "./User";
import InventoryCustomer from "./InventoryCustomer";
import InventorySale from "./InventorySale";
import InventoryReceivable from "./InventoryReceivable";

export type InventoryStoreCreditOverrideType =
  | "limit"
  | "overdue"
  | "limit_and_overdue";

@Table({
  tableName: "InventoryStoreCreditOverrides",
  indexes: [
    {
      name: "InventoryStoreCreditOverrides_company_customer_created_idx",
      fields: ["companyId", "customerId", "createdAt"]
    },
    {
      name: "InventoryStoreCreditOverrides_company_sale_idx",
      fields: ["companyId", "saleId"]
    }
  ]
})
class InventoryStoreCreditOverride extends Model<InventoryStoreCreditOverride> {
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

  @AllowNull
  @ForeignKey(() => InventoryReceivable)
  @Column
  receivableId: number | null;

  @BelongsTo(() => InventoryReceivable)
  receivable: InventoryReceivable;

  @Column(DataType.STRING(32))
  overrideType: InventoryStoreCreditOverrideType;

  @Column(DataType.DECIMAL(12, 2))
  creditLimitAtMoment: string | number;

  @Column(DataType.DECIMAL(12, 2))
  creditUsedAtMoment: string | number;

  @Column(DataType.DECIMAL(12, 2))
  creditAvailableAtMoment: string | number;

  @Column(DataType.DECIMAL(12, 2))
  requestedAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  exceededAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  overdueOpenAmountAtMoment: string | number;

  @AllowNull
  @Column(DataType.TEXT)
  reason: string | null;

  @ForeignKey(() => User)
  @Column
  authorizedByUserId: number;

  @BelongsTo(() => User, {
    foreignKey: "authorizedByUserId",
    as: "authorizedByUser"
  })
  authorizedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryStoreCreditOverride;
