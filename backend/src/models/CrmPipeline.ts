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
  Default
} from "sequelize-typescript";
import Company from "./Company";
import CrmStage from "./CrmStage";

@Table({ tableName: "CrmPipelines" })
class CrmPipeline extends Model<CrmPipeline> {
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
  name: string;

  @Default("general")
  @Column
  segment: string;

  @Default(false)
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => CrmStage, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  stages: CrmStage[];
}

export default CrmPipeline;
