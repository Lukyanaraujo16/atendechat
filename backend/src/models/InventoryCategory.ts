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

@Table({
  tableName: "InventoryCategories",
  indexes: [
    {
      name: "InventoryCategories_companyId_active_position_idx",
      fields: ["companyId", "active", "position"]
    },
    {
      name: "InventoryCategories_companyId_parentId_name_idx",
      fields: ["companyId", "parentId", "name"]
    }
  ]
})
class InventoryCategory extends Model<InventoryCategory> {
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
  parentId: number | null;

  @BelongsTo(() => InventoryCategory, {
    foreignKey: "parentId",
    as: "parent"
  })
  parent: InventoryCategory;

  @HasMany(() => InventoryCategory, {
    foreignKey: "parentId",
    as: "children"
  })
  children: InventoryCategory[];

  @Column(DataType.STRING(120))
  name: string;

  @AllowNull
  @Column(DataType.TEXT)
  description: string | null;

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

  @HasMany(() => InventoryProduct, {
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
    hooks: true
  })
  products: InventoryProduct[];
}

export default InventoryCategory;
