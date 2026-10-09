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
import InventoryProduct from "./InventoryProduct";
import InventoryProductVariant from "./InventoryProductVariant";

/** Registro unificado de SKU/barcode vendáveis por empresa (simples + variantes). */
@Table({
  tableName: "InventorySellableCodes"
})
class InventorySellableCode extends Model<InventorySellableCode> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** sku | barcode */
  @Column(DataType.STRING(16))
  codeType: string;

  @Column(DataType.STRING(64))
  codeValue: string;

  @AllowNull
  @ForeignKey(() => InventoryProduct)
  @Column
  productId: number | null;

  @BelongsTo(() => InventoryProduct)
  product: InventoryProduct;

  @AllowNull
  @ForeignKey(() => InventoryProductVariant)
  @Column
  variantId: number | null;

  @BelongsTo(() => InventoryProductVariant)
  variant: InventoryProductVariant;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySellableCode;
