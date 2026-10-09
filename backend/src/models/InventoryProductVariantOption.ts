import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import InventoryProductVariant from "./InventoryProductVariant";
import InventoryProductAttribute from "./InventoryProductAttribute";
import InventoryProductAttributeOption from "./InventoryProductAttributeOption";

@Table({
  tableName: "InventoryProductVariantOptions",
  indexes: [
    {
      name: "InventoryProductVariantOptions_variant_attr_uq",
      unique: true,
      fields: ["variantId", "attributeId"]
    }
  ]
})
class InventoryProductVariantOption extends Model<InventoryProductVariantOption> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventoryProductVariant)
  @Column
  variantId: number;

  @BelongsTo(() => InventoryProductVariant)
  variant: InventoryProductVariant;

  @ForeignKey(() => InventoryProductAttribute)
  @Column
  attributeId: number;

  @BelongsTo(() => InventoryProductAttribute)
  attribute: InventoryProductAttribute;

  @ForeignKey(() => InventoryProductAttributeOption)
  @Column
  optionId: number;

  @BelongsTo(() => InventoryProductAttributeOption)
  option: InventoryProductAttributeOption;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryProductVariantOption;
