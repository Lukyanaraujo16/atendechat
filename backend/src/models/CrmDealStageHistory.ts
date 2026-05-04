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
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import CrmDeal from "./CrmDeal";
import CrmStage from "./CrmStage";
import User from "./User";

@Table({ tableName: "CrmDealStageHistory" })
class CrmDealStageHistory extends Model<CrmDealStageHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => CrmDeal)
  @Column
  dealId: number;

  @BelongsTo(() => CrmDeal)
  deal: CrmDeal;

  @AllowNull
  @ForeignKey(() => CrmStage)
  @Column
  fromStageId: number | null;

  @BelongsTo(() => CrmStage, { foreignKey: "fromStageId", as: "fromStage" })
  fromStage: CrmStage;

  @ForeignKey(() => CrmStage)
  @Column
  toStageId: number;

  @BelongsTo(() => CrmStage, { foreignKey: "toStageId", as: "toStage" })
  toStage: CrmStage;

  @Column(DataType.DATE)
  enteredAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  leftAt: Date | null;

  @AllowNull
  @Column(DataType.BIGINT)
  durationMs: string | number | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  changedBy: number | null;

  @BelongsTo(() => User, { foreignKey: "changedBy", as: "changer" })
  changer: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmDealStageHistory;
