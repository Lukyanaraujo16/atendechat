import {
  Table,
  Column,
  CreatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventoryProduct from "./InventoryProduct";
import User from "./User";

@Table({
  tableName: "InventoryStockMovements",
  updatedAt: false,
  indexes: [
    {
      name: "InventoryStockMovements_companyId_productId_createdAt_idx",
      fields: ["companyId", "productId", "createdAt"]
    },
    {
      name: "InventoryStockMovements_companyId_reference_idx",
      fields: ["companyId", "referenceType", "referenceId"]
    }
  ]
})
class InventoryStockMovement extends Model<InventoryStockMovement> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventoryProduct)
  @Column
  productId: number;

  @BelongsTo(() => InventoryProduct)
  product: InventoryProduct;

  @Column(DataType.STRING(32))
  type: string;

  @Column(DataType.DECIMAL(12, 3))
  quantity: string | number;

  @Column(DataType.DECIMAL(12, 3))
  balanceAfter: string | number;

  @AllowNull
  @Column(DataType.DECIMAL(12, 2))
  unitCost: string | number | null;

  @AllowNull
  @Column(DataType.STRING(32))
  referenceType: string | null;

  @AllowNull
  @Column
  referenceId: number | null;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "creator" })
  creator: User;

  @CreatedAt
  createdAt: Date;
}

export default InventoryStockMovement;
