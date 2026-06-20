import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import InstagramAccountQueue from "./InstagramAccountQueue";
import Company from "./Company";

@Table
class InstagramAccount extends Model<InstagramAccount> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("PENDING")
  @Column(DataType.STRING(32))
  status: string;

  @AllowNull(true)
  @Column
  instagramBusinessAccountId: string;

  @AllowNull(true)
  @Column
  facebookPageId: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  pageAccessToken: string;

  @AllowNull(true)
  @Column
  tokenExpiresAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  scopes: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  profilePicUrl: string;

  /** instagram_login | manual_token | facebook_page */
  @AllowNull(true)
  @Column(DataType.STRING(32))
  connectedVia: string;

  @AllowNull(true)
  @Column
  metaUserId: string;

  @AllowNull(true)
  @Column
  tokenRefreshedAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  connectionError: string;

  @Default(false)
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => InstagramAccountQueue)
  queues: Array<Queue & { InstagramAccountQueue: InstagramAccountQueue }>;

  @HasMany(() => InstagramAccountQueue)
  instagramAccountQueues: InstagramAccountQueue[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default InstagramAccount;
