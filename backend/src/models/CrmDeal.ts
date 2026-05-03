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

  @AllowNull
  @Column(DataType.DATE)
  expectedCloseAt: Date | null;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

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

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmDeal;
