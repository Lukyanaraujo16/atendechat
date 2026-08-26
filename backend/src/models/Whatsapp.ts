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
  HasOne,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Company from "./Company";
import Prompt from "./Prompt";
import AiAgent from "./AiAgent";
import QueueIntegrations from "./QueueIntegrations";
import {FlowBuilderModel} from "./FlowBuilder";
import WhatsappEvolutionCredential from "./WhatsappEvolutionCredential";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  session: string;

  @Column(DataType.TEXT)
  qrcode: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Default("")
  @Column(DataType.TEXT)
  greetingMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  complationMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  outOfHoursMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  ratingMessage: string;

  /**
   * Legado Baileys: "stable" | "beta".
   * NÃO representa Evolution/Baileys como transporte.
   * Ver connectionProvider.
   */
  @Column({ defaultValue: "stable" })
  provider: string;

  /**
   * Provider de transporte da conexão: "baileys" | "evolution".
   * Default baileys — conexões existentes e creates sem campo.
   */
  @Default("baileys")
  @AllowNull(false)
  @Column(DataType.STRING(32))
  connectionProvider: string;

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  /** Se true, após persistir mensagem recebida, envia read receipt ao WhatsApp (sincroniza “lido” no telefone). */
  @Default(true)
  @Column
  autoReadMessages: boolean;

  /** Se true, novos grupos (contatos isGroup) criados por esta conexão já nascem visíveis para usuários comuns. */
  @Default(false)
  @Column
  defaultGroupVisible: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasOne(() => WhatsappEvolutionCredential)
  evolutionCredential: WhatsappEvolutionCredential;

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token: string;

  //@Default(0)
  //@Column
  //timeSendQueue: number;

  //@Column
  //sendIdQueue: number;

  @Column
  transferQueueId: number;

  @Column
  timeToTransfer: number;

  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @AllowNull
  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number | null;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @Default(false)
  @Column
  aiAgentEnabled: boolean;

  @Default("disabled")
  @Column(DataType.STRING(32))
  aiAgentMode: string;

  @Default(false)
  @Column
  functionCallingShadow: boolean;

  @Default(false)
  @Column
  functionCallingLive: boolean;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @Column
  maxUseBotQueues: number;

  @Column
  timeUseBotQueues: string;

  @Column
  expiresTicket: number;

  @Column
  expiresInactiveMessage: string;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdNotPhrase: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdWelcome: number;

  @BelongsTo(() => FlowBuilderModel)
  flowBuilder: FlowBuilderModel;

  /** accept | reject — null usa Settings globais da empresa */
  @Column(DataType.STRING(16))
  callHandlingMode: string | null;

  @Column
  sendMessageOnCallReject: boolean | null;

  @Column(DataType.TEXT)
  callRejectMessage: string | null;

  /** ignore | receive — null usa Settings globais */
  @Column(DataType.STRING(16))
  groupMessagesMode: string | null;

  /** enabled | disabled — null herda Settings da empresa */
  @Column(DataType.STRING(16))
  sendGreetingAccepted: string | null;

  @Column(DataType.STRING(16))
  sendMsgTransfTicket: string | null;

  @Column(DataType.STRING(16))
  sendGreetingMessageOneQueues: string | null;

  /** text | button | list — null herda Settings.chatBotType da empresa */
  @Column(DataType.STRING(16))
  chatBotType: string | null;

  /**
   * Quem pode ver tickets desta conexão:
   * all | admin_supervisor (futuro: specific_users, specific_queues)
   */
  @Default("all")
  @Column(DataType.STRING(32))
  ticketVisibility: string;

  /** enabled | disabled — null herda Settings.userRating da empresa */
  @Column(DataType.STRING(16))
  userRating: string | null;

  /** disabled | company | queue — null herda Settings.scheduleType da empresa */
  @Column(DataType.STRING(16))
  scheduleType: string | null;
}

export default Whatsapp;
