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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import InstagramAccount from "./InstagramAccount";

@Table
class MetaWebhookEvent extends Model<MetaWebhookEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(true)
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(true)
  @ForeignKey(() => InstagramAccount)
  @Column
  instagramAccountId: number;

  @BelongsTo(() => InstagramAccount)
  instagramAccount: InstagramAccount;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  object: string;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  eventType: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  externalEventId: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  rawPayload: Record<string, unknown> | null;

  @Default(false)
  @Column
  signatureValid: boolean;

  @Default(false)
  @Column
  processed: boolean;

  @AllowNull(false)
  @Column
  receivedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MetaWebhookEvent;
