import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AutoIncrement,
  Default,
  BeforeCreate,
  BelongsToMany,
  AllowNull, DataType
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";

import Contact from "./Contact";
import Message from "./Message";
import Queue from "./Queue";
import User from "./User";
import Whatsapp from "./Whatsapp";
import InstagramAccount from "./InstagramAccount";
import Company from "./Company";
import QueueOption from "./QueueOption";
import Tag from "./Tag";
import TicketTag from "./TicketTag";
import PinnedTicket from "./PinnedTicket";
import QueueIntegrations from "./QueueIntegrations";
import Prompt from "./Prompt";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Default("whatsapp")
  @Column(DataType.STRING(16))
  channel: string;

  @AllowNull(true)
  @ForeignKey(() => InstagramAccount)
  @Column
  instagramAccountId: number;

  @BelongsTo(() => InstagramAccount)
  instagramAccount: InstagramAccount;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Column
  chatbot: boolean;

  @ForeignKey(() => QueueOption)
  @Column
  queueOptionId: number;

  @BelongsTo(() => QueueOption)
  queueOption: QueueOption;

  @HasMany(() => Message)
  messages: Message[];

  @HasMany(() => TicketTag)
  ticketTags: TicketTag[];

  @HasMany(() => PinnedTicket, { foreignKey: "ticketId", as: "userPin" })
  userPin: PinnedTicket[];

  @BelongsToMany(() => Tag, () => TicketTag)
  tags: Tag[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default(uuidv4())
  @Column
  uuid: string;

  @BeforeCreate
  static setUUID(ticket: Ticket) {
    ticket.uuid = uuidv4();
  }

  @Default(false)
  @Column
  useIntegration: boolean;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegration: QueueIntegrations;

  @Column
  typebotSessionId: string;

  @Default(false)
  @Column
  typebotStatus: boolean

  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @Column
  fromMe: boolean;

  @AllowNull(false)
  @Default(0)
  @Column
  amountUsedBotQueues: number;

  /** Contador de opções inválidas consecutivas no menu do FlowBuilder (fallback humano após limite). */
  @AllowNull(false)
  @Default(0)
  @Column
  invalidMenuAttempts: number;

  @Column
  flowWebhook: boolean;

  @Column
  lastFlowId: string;

  @Column
  hashFlowId: string;

  @Column
  flowStopped: string;

  @Column(DataType.JSON)
  dataWebhook: {} | null;

  @Default(false)
  @Column
  aiAgentPaused: boolean;

  @AllowNull(true)
  @Column
  aiAgentPausedAt: Date | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  aiAgentPausedBy: number | null;

  @Default(false)
  @Column
  aiAgentHandoffRequested: boolean;

  @AllowNull(true)
  @Column
  aiAgentHandoffRequestedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  aiAgentHandoffReason: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  aiAgentHandoffBy: string | null;

  @AllowNull(true)
  @Column
  aiAgentCycleStartedAt: Date | null;
}

export default Ticket;
