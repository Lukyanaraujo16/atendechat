import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  AutoIncrement,
  BelongsTo,
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import CrmPipeline from "./CrmPipeline";

export type CrmCustomFieldType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "boolean";

@Table({ tableName: "CrmCustomFields" })
class CrmCustomField extends Model<CrmCustomField> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull
  @ForeignKey(() => CrmPipeline)
  @Column
  pipelineId: number | null;

  @BelongsTo(() => CrmPipeline)
  pipeline: CrmPipeline;

  @Column
  key: string;

  @Column
  label: string;

  @Column
  type: CrmCustomFieldType;

  @AllowNull
  @Column(DataType.JSON)
  options: string[] | null;

  @Default(false)
  @Column
  required: boolean;

  @Default(false)
  @Column
  visibleOnCard: boolean;

  @Default(0)
  @Column
  position: number;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmCustomField;
