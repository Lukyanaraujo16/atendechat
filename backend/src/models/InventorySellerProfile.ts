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
import User from "./User";

@Table({
  tableName: "InventorySellerProfiles",
  indexes: [
    {
      unique: true,
      name: "InventorySellerProfiles_companyId_userId_unique",
      fields: ["companyId", "userId"]
    }
  ]
})
class InventorySellerProfile extends Model<InventorySellerProfile> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User, { foreignKey: "userId", as: "user" })
  user: User;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  commissionRate: string | number;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySellerProfile;
