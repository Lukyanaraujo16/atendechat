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
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import CrmPipeline from "./CrmPipeline";
import CrmStage from "./CrmStage";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";

export type CrmDealStatus = "open" | "won" | "lost";
export type CrmDealSource = "whatsapp" | "manual" | "instagram" | "other";
export type CrmDealPriority = "low" | "medium" | "high" | "urgent";

@Table({ tableName: "CrmDeals" })
class CrmDeal extends Model<CrmDeal> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => CrmPipeline)
  @Column
  pipelineId: number;

  @BelongsTo(() => CrmPipeline)
  pipeline: CrmPipeline;

  @ForeignKey(() => CrmStage)
  @Column
  stageId: number;

  @BelongsTo(() => CrmStage)
  stage: CrmStage;

  @AllowNull
  @ForeignKey(() => Contact)
  @Column
  contactId: number | null;

  @BelongsTo(() => Contact, { foreignKey: "contactId", as: "contact" })
  contact: Contact;

  @AllowNull
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number | null;

  @BelongsTo(() => Ticket, { foreignKey: "ticketId", as: "ticket" })
  ticket: Ticket;

  @Column
  title: string;

  @AllowNull
  @Column(DataType.DECIMAL(12, 2))
  value: string | number | null;

  @Default("open")
  @Column
  status: CrmDealStatus;

  @Default("manual")
  @Column
  source: CrmDealSource;

  @Default("medium")
  @Column
  priority: CrmDealPriority;

  @AllowNull
  @Column(DataType.JSON)
  tags: string[] | null;

  @AllowNull
  @Column(DataType.DATE)
  lastActivityAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  expectedCloseAt: Date | null;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

  @AllowNull
  @Column(DataType.DATE)
  nextFollowUpAt: Date | null;

  @AllowNull
  @Column(DataType.TEXT)
  followUpNote: string | null;

  @AllowNull
  @Column(DataType.DATE)
  followUpNotifiedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  attentionAt: Date | null;

  @AllowNull
  @Column(DataType.TEXT)
  attentionReason: string | null;

  @AllowNull
  @Column(DataType.DATE)
  attentionNotifiedAt: Date | null;

  /** Última notificação de automação “parado”; limpa quando há atividade no deal. */
  @AllowNull
  @Column(DataType.DATE)
  automationLastStaleNotifyAt: Date | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "creator" })
  creator: User;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  assignedUserId: number | null;

  @BelongsTo(() => User, { foreignKey: "assignedUserId", as: "assignedUser" })
  assignedUser: User;

  @AllowNull
  @Column(DataType.JSON)
  customFields: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmDeal;
