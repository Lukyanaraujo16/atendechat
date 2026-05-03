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
  Default
} from "sequelize-typescript";
import Company from "./Company";
import CrmPipeline from "./CrmPipeline";

@Table({ tableName: "CrmStages" })
class CrmStage extends Model<CrmStage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => CrmPipeline)
  @Column
  pipelineId: number;

  @BelongsTo(() => CrmPipeline)
  pipeline: CrmPipeline;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  name: string;

  @Default(0)
  @Column
  position: number;

  @Default("#90caf9")
  @Column
  color: string;

  @Default(false)
  @Column
  isWon: boolean;

  @Default(false)
  @Column
  isLost: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmStage;
