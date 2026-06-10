import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Default,
  HasMany,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import ContactAssignment from "./ContactAssignment";
import ContactQueueVisibility from "./ContactQueueVisibility";
import Ticket from "./Ticket";
import Company from "./Company";
import Schedule from "./Schedule";
import Whatsapp from "./Whatsapp";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  number: string;

  @Default("whatsapp")
  @Column(DataType.STRING(16))
  channel: string;

  @AllowNull(true)
  @Column
  instagramScopedId: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  profilePicUrl: string;

  @Default(false)
  @Column
  isGroup: boolean;

  /** Se true (e isGroup=true), usuários comuns podem visualizar/atender o grupo. */
  @Default(false)
  @Column
  groupVisible: boolean;

  @Default(false)
  @Column
  disableBot: boolean;

  /** Quando true, pula o chatbot e encaminha direto para humano. */
  @Default(false)
  @Column
  chatbotDisabled: boolean;

  @AllowNull(true)
  @Column(DataType.TEXT)
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @HasMany(() => ContactAssignment, { as: "assignments" })
  assignments: ContactAssignment[];

  @HasMany(() => ContactQueueVisibility, { as: "authorizedQueues" })
  authorizedQueues: ContactQueueVisibility[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Schedule, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  schedules: Schedule[];

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;
}

export default Contact;
