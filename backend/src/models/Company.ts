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
  DataType,
  HasMany,
  Default,
  HasOne
} from "sequelize-typescript";
import Contact from "./Contact";
import Message from "./Message";

import Plan from "./Plan";
import Queue from "./Queue";
import Setting from "./Setting";
import Ticket from "./Ticket";
import TicketTraking from "./TicketTraking";
import User from "./User";
import UserRating from "./UserRating";
import Whatsapp from "./Whatsapp";
import InventorySettings from "./InventorySettings";
import InventoryCategory from "./InventoryCategory";
import InventoryProduct from "./InventoryProduct";
import InventoryStockMovement from "./InventoryStockMovement";
import InventorySellerProfile from "./InventorySellerProfile";
import InventorySale from "./InventorySale";
import InventorySaleItem from "./InventorySaleItem";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column
  status: boolean;

  @Column
  dueDate: string;

  @Column
  recurrence: string;

  @Column
  language: string;

  /** IANA timezone (ex.: America/Sao_Paulo) — usado em agendamentos/recorrência */
  @Column({ defaultValue: "America/Sao_Paulo" })
  timezone: string;

  @Column({
    type: DataType.JSONB
  })
  schedules: [];

  /** Overrides de módulos por empresa (Super Admin). {} = seguir apenas o plano. */
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: {}
  })
  modulePermissions: Record<string, boolean>;

  /** Notas internas (apenas Super Admin; não expor a clientes). */
  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  internalNotes: string | null;

  /** Valor mensal negociado (override sobre plan.value); null = usar plano padrão. */
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true
  })
  contractedPlanValue: string | number | null;

  /** Override do limite de armazenamento (GB). null = usar limite do plano. */
  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  storageLimitGb: string | number | null;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  storageUsedBytes: number | string;

  @Column({ type: DataType.DATE, allowNull: true })
  storageCalculatedAt: Date | null;

  /** Último alerta de threshold enviado: 0 | 80 | 90 | 100 — deduplica notificações ao subir/descer percentual. */
  @Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 0 })
  storageAlertWatermark: number;

  /** Quando true, nenhuma conversa passa pelo chatbot (bypass global). */
  @Default(false)
  @Column
  chatbotDisabled: boolean;

  /** Quando true, respeita `chatbotSchedule` para decidir bypass por horário. */
  @Default(false)
  @Column
  chatbotScheduleEnabled: boolean;

  /** Horário de chatbot por empresa (timezone + dias). */
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: null })
  chatbotSchedule: unknown | null;

  /** Segmento de negócio (templates de CRM ao criar pipeline padrão). */
  @Default("general")
  @Column
  businessSegment: string;

  /** CRM: todos os utilizadores vs. só deals atribuídos ao próprio (operadores). */
  @Default("all")
  @Column(DataType.STRING(16))
  crmVisibilityMode: string;

  /**
   * Setor de contingência: utilizadores deste setor visualizam tickets com queueId null.
   * Não atribui o ticket — só amplia visibilidade operacional.
   */
  @ForeignKey(() => Queue)
  @Column({ allowNull: true, defaultValue: null })
  unassignedTicketsQueueId: number | null;

  @BelongsTo(() => Queue, {
    foreignKey: "unassignedTicketsQueueId",
    as: "unassignedTicketsQueue"
  })
  unassignedTicketsQueue: Queue;

  @ForeignKey(() => Plan)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  users: User[];

  @HasMany(() => UserRating, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  userRatings: UserRating[];

  @HasMany(() => Queue, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  queues: Queue[];

  @HasMany(() => Whatsapp, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  whatsapps: Whatsapp[];

  @HasMany(() => Message, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  messages: Message[];

  @HasMany(() => Contact, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  contacts: Contact[];

  @HasMany(() => Setting, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  settings: Setting[];

  @HasMany(() => Ticket, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  tickets: Ticket[];

  @HasMany(() => TicketTraking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  ticketTrankins: TicketTraking[];

  @HasOne(() => InventorySettings, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventorySettings: InventorySettings;

  @HasMany(() => InventoryCategory, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventoryCategories: InventoryCategory[];

  @HasMany(() => InventoryProduct, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventoryProducts: InventoryProduct[];

  @HasMany(() => InventoryStockMovement, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventoryStockMovements: InventoryStockMovement[];

  @HasMany(() => InventorySellerProfile, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventorySellerProfiles: InventorySellerProfile[];

  @HasMany(() => InventorySale, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventorySales: InventorySale[];

  @HasMany(() => InventorySaleItem, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  inventorySaleItems: InventorySaleItem[];
}

export default Company;
