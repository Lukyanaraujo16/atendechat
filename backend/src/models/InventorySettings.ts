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
  DataType,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "InventorySettings",
  indexes: [
    {
      unique: true,
      name: "InventorySettings_companyId_unique",
      fields: ["companyId"]
    }
  ]
})
class InventorySettings extends Model<InventorySettings> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  defaultCommissionRate: string | number;

  @Default(false)
  @Column
  allowNegativeStock: boolean;

  @AllowNull
  @Column(DataType.STRING(16))
  saleNumberPrefix: string | null;

  @Default(1)
  @Column
  nextSaleNumber: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySettings;
