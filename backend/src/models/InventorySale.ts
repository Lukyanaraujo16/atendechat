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
  HasMany,
  HasOne,
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import InventorySaleItem from "./InventorySaleItem";
import InventoryDeliveryMethod from "./InventoryDeliveryMethod";
import InventorySaleDelivery from "./InventorySaleDelivery";
import InventorySalePayment from "./InventorySalePayment";
import InventoryCustomer from "./InventoryCustomer";

export type InventorySaleStatus = "draft" | "completed" | "cancelled";
export type InventorySaleSource = "manual" | "ticket" | "whatsapp";
export type InventoryPaymentStatus = "unpaid" | "paid" | "partial" | "refunded";
export type InventoryPaymentMethod =
  | "cash"
  | "pix"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "boleto"
  | "other"
  | "store_credit";

@Table({
  tableName: "InventorySales",
  indexes: [
    {
      unique: true,
      name: "InventorySales_companyId_saleNumber_unique",
      fields: ["companyId", "saleNumber"]
    },
    {
      name: "InventorySales_companyId_status_completedAt_idx",
      fields: ["companyId", "status", "completedAt"]
    },
    {
      name: "InventorySales_companyId_contactId_completedAt_idx",
      fields: ["companyId", "contactId", "completedAt"]
    },
    {
      name: "InventorySales_companyId_sellerUserId_completedAt_idx",
      fields: ["companyId", "sellerUserId", "completedAt"]
    },
    {
      name: "InventorySales_companyId_ticketId_idx",
      fields: ["companyId", "ticketId"]
    },
    {
      name: "InventorySales_companyId_customerId_completedAt_idx",
      fields: ["companyId", "customerId", "completedAt"]
    }
  ]
})
class InventorySale extends Model<InventorySale> {
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
  saleNumber: number;

  @Default("draft")
  @Column(DataType.STRING(16))
  status: InventorySaleStatus;

  @Default("manual")
  @Column(DataType.STRING(16))
  source: InventorySaleSource;

  @AllowNull
  @ForeignKey(() => Contact)
  @Column
  contactId: number | null;

  @BelongsTo(() => Contact)
  contact: Contact;

  @AllowNull
  @ForeignKey(() => InventoryCustomer)
  @Column
  customerId: number | null;

  @BelongsTo(() => InventoryCustomer)
  customer: InventoryCustomer;

  @AllowNull
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number | null;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  sellerUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "sellerUserId", as: "seller" })
  seller: User;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  subtotalAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  discountAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  totalAmount: string | number;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  freightAmount: string | number;

  @AllowNull
  @ForeignKey(() => InventoryDeliveryMethod)
  @Column
  deliveryMethodId: number | null;

  @BelongsTo(() => InventoryDeliveryMethod)
  deliveryMethod: InventoryDeliveryMethod;

  @AllowNull
  @Column(DataType.STRING(120))
  deliveryMethodName: string | null;

  @AllowNull
  @Column(DataType.STRING(32))
  deliveryKind: string | null;

  @AllowNull
  @Column(DataType.DECIMAL(5, 2))
  commissionRate: string | number | null;

  @AllowNull
  @Column(DataType.DECIMAL(12, 2))
  commissionAmount: string | number | null;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

  @AllowNull
  @Column(DataType.DATE)
  completedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  cancelledAt: Date | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  cancelledBy: number | null;

  @BelongsTo(() => User, { foreignKey: "cancelledBy", as: "canceller" })
  canceller: User;

  @AllowNull
  @Column(DataType.TEXT)
  cancelReason: string | null;

  @Default("unpaid")
  @Column(DataType.STRING(16))
  paymentStatus: InventoryPaymentStatus;

  @AllowNull
  @Column(DataType.STRING(32))
  paymentMethod: InventoryPaymentMethod | null;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  paidAmount: string | number;

  @AllowNull
  @Column(DataType.DATE)
  paidAt: Date | null;

  @AllowNull
  @Column(DataType.TEXT)
  paymentNotes: string | null;

  @AllowNull
  @Column(DataType.INTEGER)
  cardInstallmentCount: number | null;

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

  @HasMany(() => InventorySaleItem, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  items: InventorySaleItem[];

  @HasOne(() => InventorySaleDelivery, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  delivery: InventorySaleDelivery;

  /** Linhas 1:N — P1 fundação; escrita autoritativa entra na P2. */
  @HasMany(() => InventorySalePayment, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  payments: InventorySalePayment[];
}

export default InventorySale;
