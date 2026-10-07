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
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

export type InventoryDeliveryMethodKind =
  | "pickup"
  | "courier"
  | "carrier"
  | "other";

@Table({ tableName: "InventoryDeliveryMethods" })
class InventoryDeliveryMethod extends Model<InventoryDeliveryMethod> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  name: string;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  kind: InventoryDeliveryMethodKind;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  defaultAmount: number;

  @AllowNull(false)
  @Default(true)
  @Column
  allowAmountOverride: boolean;

  @AllowNull(false)
  @Default(true)
  @Column
  requiresAddress: boolean;

  @AllowNull(false)
  @Default(true)
  @Column
  active: boolean;

  @AllowNull(false)
  @Default(0)
  @Column
  position: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventoryDeliveryMethod;
