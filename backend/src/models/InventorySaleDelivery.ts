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
import InventorySale from "./InventorySale";

@Table({ tableName: "InventorySaleDeliveries" })
class InventorySaleDelivery extends Model<InventorySaleDelivery> {
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

  @ForeignKey(() => InventorySale)
  @AllowNull(false)
  @Column
  saleId: number;

  @BelongsTo(() => InventorySale)
  sale: InventorySale;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  recipientName: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  recipientPhone: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  postalCode: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  street: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(30))
  number: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  complement: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  district: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  city: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(2))
  state: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  notes: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySaleDelivery;
