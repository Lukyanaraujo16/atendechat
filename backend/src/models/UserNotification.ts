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
import User from "./User";
import Company from "./Company";

@Table({ tableName: "UserNotifications" })
class UserNotification extends Model<UserNotification> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull
  @ForeignKey(() => Company)
  @Column
  companyId: number | null;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  type: string;

  @Column
  title: string;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.JSON)
  data: Record<string, unknown> | null;

  @Default(false)
  @Column
  read: boolean;

  @Column(DataType.DATE)
  readAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  archivedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default UserNotification;
