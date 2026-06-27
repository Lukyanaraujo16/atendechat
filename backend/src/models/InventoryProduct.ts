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
import InventoryCategory from "./InventoryCategory";
import InventoryStockMovement from "./InventoryStockMovement";
import InventorySaleItem from "./InventorySaleItem";

@Table({
  tableName: "InventoryProducts",
  indexes: [
    {
      name: "InventoryProducts_companyId_active_name_idx",
      fields: ["companyId", "active", "name"]
    },
    {
      name: "InventoryProducts_companyId_sku_idx",
      fields: ["companyId", "sku"]
    },
    {
      name: "InventoryProducts_companyId_categoryId_idx",
      fields: ["companyId", "categoryId"]
    },
    {
      name: "InventoryProducts_companyId_currentQuantity_idx",
      fields: ["companyId", "currentQuantity"]
    }
  ]
})
class InventoryProduct extends Model<InventoryProduct> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull
  @ForeignKey(() => InventoryCategory)
  @Column
  categoryId: number | null;

  @BelongsTo(() => InventoryCategory)
  category: InventoryCategory;

  @AllowNull
  @Column(DataType.STRING(64))
  sku: string | null;

  @AllowNull
  @Column(DataType.STRING(64))
  barcode: string | null;

  @Column(DataType.STRING(200))
  name: string;

  @AllowNull
  @Column(DataType.TEXT)
  description: string | null;

  @Default("un")
  @Column(DataType.STRING(16))
  unit: string;

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

  @AllowNull
  @Column(DataType.STRING(500))
  imageUrl: string | null;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => InventoryStockMovement, {
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
    hooks: true
  })
  stockMovements: InventoryStockMovement[];

  @HasMany(() => InventorySaleItem, {
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
    hooks: true
  })
  saleItems: InventorySaleItem[];
}

export default InventoryProduct;
