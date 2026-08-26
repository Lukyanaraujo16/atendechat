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
import Whatsapp from "./Whatsapp";

@Table({ tableName: "EvolutionWebhookEvents" })
class EvolutionWebhookEvent extends Model<EvolutionWebhookEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  eventType: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  externalEventId: string;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  providerMessageId: string | null;

  @AllowNull(false)
  @Default("received")
  @Column(DataType.STRING(32))
  processingStatus: string;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  skipReason: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(512))
  errorSummary: string | null;

  @Default(false)
  @Column
  apiKeyValid: boolean;

  @Default(false)
  @Column
  processed: boolean;

  @AllowNull(true)
  @Column(DataType.JSONB)
  rawPayload: Record<string, unknown> | null;

  @AllowNull(false)
  @Column
  receivedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default EvolutionWebhookEvent;
