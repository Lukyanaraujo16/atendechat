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
import InventorySale from "./InventorySale";
import InventoryProduct from "./InventoryProduct";
import InventorySaleItemIdentifier from "./InventorySaleItemIdentifier";

@Table({
  tableName: "InventorySaleItems",
  indexes: [
    {
      name: "InventorySaleItems_saleId_idx",
      fields: ["saleId"]
    },
    {
      name: "InventorySaleItems_companyId_productId_idx",
      fields: ["companyId", "productId"]
    }
  ]
})
class InventorySaleItem extends Model<InventorySaleItem> {
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

  @ForeignKey(() => InventoryProduct)
  @Column
  productId: number;

  @BelongsTo(() => InventoryProduct)
  product: InventoryProduct;

  @Column(DataType.STRING(200))
  productName: string;

  @AllowNull
  @Column(DataType.STRING(64))
  productSku: string | null;

  @Column(DataType.STRING(16))
  unit: string;

  @Column(DataType.DECIMAL(12, 2))
  unitPrice: string | number;

  @AllowNull
  @Column(DataType.DECIMAL(12, 2))
  costPrice: string | number | null;

  @Column(DataType.DECIMAL(12, 3))
  quantity: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  discountAmount: string | number;

  @Column(DataType.DECIMAL(12, 2))
  totalAmount: string | number;

  @Default(true)
  @Column
  trackStock: boolean;

  @HasMany(() => InventorySaleItemIdentifier, {
    as: "identifiers",
    foreignKey: "saleItemId",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  identifiers: InventorySaleItemIdentifier[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySaleItem;
