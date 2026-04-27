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
  AllowNull
} from "sequelize-typescript";
import User from "./User";
import Company from "./Company";

@Table({ tableName: "UserNotificationPreferences" })
class UserNotificationPreferences extends Model<UserNotificationPreferences> {
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

  @Default(true)
  @Column
  pushEnabled: boolean;

  @Default(true)
  @Column
  notifyNewTickets: boolean;

  @Default(true)
  @Column
  notifyAssignedTickets: boolean;

  @Default(true)
  @Column
  notifyTicketMessages: boolean;

  @Default(true)
  @Column
  notifyTicketTransfers: boolean;

  @Default(true)
  @Column
  inAppEnabled: boolean;

  @Default(true)
  @Column
  inAppNewTickets: boolean;

  @Default(true)
  @Column
  inAppAssignedTickets: boolean;

  @Default(true)
  @Column
  inAppTicketMessages: boolean;

  @Default(true)
  @Column
  inAppTicketTransfers: boolean;

  @Default(true)
  @Column
  inAppAgenda: boolean;

  @Default(true)
  @Column
  inAppBilling: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default UserNotificationPreferences;
