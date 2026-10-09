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
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventoryProductAttribute from "./InventoryProductAttribute";

@Table({
  tableName: "InventoryProductAttributeOptions",
  indexes: [
    {
      name: "InventoryProductAttributeOptions_company_attr_value_idx",
      unique: true,
      fields: ["companyId", "attributeId", "value"]
    }
  ]
})
class InventoryProductAttributeOption extends Model<InventoryProductAttributeOption> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventoryProductAttribute)
  @Column
  attributeId: number;

  @BelongsTo(() => InventoryProductAttribute)
  attribute: InventoryProductAttribute;

  @Column(DataType.STRING(120))
  value: string;

  @Default(0)
  @Column
  position: number;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryProductAttributeOption;
