import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import AiAgentRuntimeLog from "./AiAgentRuntimeLog";
import AiAgent from "./AiAgent";
import Ticket from "./Ticket";
import User from "./User";

@Table({
  tableName: "AiAgentSuggestionReviews",
  indexes: [
    {
      name: "AiAgentSuggestionReviews_company_log_uq",
      unique: true,
      fields: ["companyId", "aiAgentRuntimeLogId"]
    },
    {
      name: "AiAgentSuggestionReviews_company_createdAt_idx",
      fields: ["companyId", "createdAt"]
    }
  ]
})
class AiAgentSuggestionReview extends Model<AiAgentSuggestionReview> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgentRuntimeLog)
  @Column
  aiAgentRuntimeLogId: number;

  @BelongsTo(() => AiAgentRuntimeLog)
  runtimeLog: AiAgentRuntimeLog;

  @AllowNull(true)
  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number | null;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @AllowNull(true)
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number | null;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Column(DataType.STRING(16))
  rating: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  tags: string[] | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  note: string | null;

  @ForeignKey(() => User)
  @Column
  reviewedBy: number;

  @BelongsTo(() => User)
  reviewer: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentSuggestionReview;
