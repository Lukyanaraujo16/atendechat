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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import InventorySale from "./InventorySale";

@Table({
  tableName: "InventoryDiscountAuthorizations",
  indexes: [
    {
      name: "InventoryDiscountAuthorizations_company_sale_idx",
      fields: ["companyId", "saleId"]
    },
    {
      name: "InventoryDiscountAuthorizations_company_created_idx",
      fields: ["companyId", "createdAt"]
    }
  ]
})
class InventoryDiscountAuthorization extends Model<InventoryDiscountAuthorization> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventorySale)
  @Column
  saleId: number;

  @BelongsTo(() => InventorySale)
  sale: InventorySale;

  @ForeignKey(() => User)
  @Column
  authorizedByUserId: number;

  @BelongsTo(() => User, {
    foreignKey: "authorizedByUserId",
    as: "authorizedByUser"
  })
  authorizedByUser: User;

  @Column(DataType.TEXT)
  reason: string;

  @Column(DataType.DECIMAL(8, 4))
  effectiveDiscountPercent: string | number;

  @Column(DataType.DECIMAL(5, 2))
  maxAllowedPercent: string | number;

  @Column(DataType.DECIMAL(12, 2))
  merchandiseAfterItemDiscounts: string | number;

  @Column(DataType.DECIMAL(12, 2))
  itemDiscountTotal: string | number;

  @Column(DataType.DECIMAL(12, 2))
  globalDiscountAmount: string | number;

  @Column(DataType.DECIMAL(12, 2))
  netMerchandise: string | number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryDiscountAuthorization;
