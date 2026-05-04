import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  AutoIncrement,
  BelongsTo,
  Default,
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "CrmSavedViews" })
class CrmSavedView extends Model<CrmSavedView> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  name: string;

  @Column(DataType.JSON)
  filters: Record<string, unknown>;

  @Default(false)
  @Column
  isDefault: boolean;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "creator" })
  creator: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmSavedView;
