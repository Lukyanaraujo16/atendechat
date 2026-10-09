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
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventoryProductAttributeOption from "./InventoryProductAttributeOption";

@Table({
  tableName: "InventoryProductAttributes",
  indexes: [
    {
      name: "InventoryProductAttributes_companyId_name_idx",
      unique: true,
      fields: ["companyId", "name"]
    }
  ]
})
class InventoryProductAttribute extends Model<InventoryProductAttribute> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(80))
  name: string;

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

  @HasMany(() => InventoryProductAttributeOption, {
    foreignKey: "attributeId",
    onDelete: "CASCADE",
    hooks: true
  })
  options: InventoryProductAttributeOption[];
}

export default InventoryProductAttribute;
