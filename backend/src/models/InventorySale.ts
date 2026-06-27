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
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import InventorySaleItem from "./InventorySaleItem";

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
  | "other";

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
}

export default InventorySale;
