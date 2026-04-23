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
  Default
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import Plan from "./Plan";

export type SignupRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "invited"
  | "activated";

@Table({ tableName: "CompanySignupRequests" })
class CompanySignupRequest extends Model<CompanySignupRequest> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyName: string;

  @Column
  adminName: string;

  @Column
  email: string;

  @Column
  phone: string | null;

  @ForeignKey(() => Plan)
  @Column
  planId: number | null;

  @Column
  recurrence: string | null;

  @Column
  dueDate: string | null;

  @Column
  campaignsEnabled: boolean;

  @Column(DataType.TEXT)
  notes: string | null;

  @Column
  status: SignupRequestStatus;

  @Column(DataType.TEXT)
  rejectReason: string | null;

  @ForeignKey(() => User)
  @Column
  reviewedByUserId: number | null;

  @Column
  reviewedAt: Date | null;

  @Column
  approvedAt: Date | null;

  @Column
  rejectedAt: Date | null;

  @Column
  invitationSentAt: Date | null;

  /** Primeiro envio de convite bem-sucedido (aprovação ou primeiro reenvio). */
  @Column
  firstInvitationSentAt: Date | null;

  @Default(0)
  @Column
  invitationResentCount: number;

  @Column(DataType.JSON)
  invitationResentHistory: object | null;

  @Column
  activatedAt: Date | null;

  @Column
  firstLoginAt: Date | null;

  @ForeignKey(() => Company)
  @Column
  createdCompanyId: number | null;

  @BelongsTo(() => Company)
  createdCompany: Company;

  @BelongsTo(() => User)
  reviewedBy: User;

  @BelongsTo(() => Plan)
  plan: Plan;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanySignupRequest;
