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
import InventoryProduct from "./InventoryProduct";
import InventoryProductVariantOption from "./InventoryProductVariantOption";
import InventoryStockMovement from "./InventoryStockMovement";
import InventorySaleItem from "./InventorySaleItem";

@Table({
  tableName: "InventoryProductVariants",
  indexes: [
    {
      name: "InventoryProductVariants_company_product_combo_uq",
      unique: true,
      fields: ["companyId", "productId", "combinationKey"]
    },
    {
      name: "InventoryProductVariants_companyId_sku_idx",
      fields: ["companyId", "sku"]
    },
    {
      name: "InventoryProductVariants_company_product_active_idx",
      fields: ["companyId", "productId", "active"]
    }
  ]
})
class InventoryProductVariant extends Model<InventoryProductVariant> {
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

  @Column(DataType.STRING(200))
  label: string;

  @Column(DataType.STRING(500))
  combinationKey: string;

  @AllowNull
  @Column(DataType.STRING(64))
  sku: string | null;

  @AllowNull
  @Column(DataType.STRING(64))
  barcode: string | null;

  @Column(DataType.DECIMAL(12, 2))
  salePrice: string | number;

  @AllowNull
  @Column(DataType.DECIMAL(12, 2))
  costPrice: string | number | null;

  @Default(true)
  @Column
  trackStock: boolean;

  @Default(0)
  @Column(DataType.DECIMAL(12, 3))
  currentQuantity: string | number;

  @AllowNull
  @Column(DataType.DECIMAL(12, 3))
  minStock: string | number | null;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => InventoryProductVariantOption, {
    foreignKey: "variantId",
    onDelete: "CASCADE",
    hooks: true
  })
  optionLinks: InventoryProductVariantOption[];

  @HasMany(() => InventoryStockMovement, {
    foreignKey: "variantId",
    onDelete: "RESTRICT",
    hooks: true
  })
  stockMovements: InventoryStockMovement[];

  @HasMany(() => InventorySaleItem, {
    foreignKey: "variantId",
    onDelete: "RESTRICT",
    hooks: true
  })
  saleItems: InventorySaleItem[];
}

export default InventoryProductVariant;
