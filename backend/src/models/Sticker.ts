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
import User from "./User";

@Table({ tableName: "Stickers" })
class Sticker extends Model<Sticker> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  name: string;

  @Column
  fileName: string;

  @Column
  filePath: string;

  @Column
  mimeType: string;

  @Column
  size: number;

  @ForeignKey(() => User)
  @Column
  createdBy: number;

  @Default(true)
  @Column
  isActive: boolean;

  @Default(0)
  @Column
  sortOrder: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User)
  creator: User;

  /** URL relativa para preview no painel (getter no cliente usa /public/). */
  get publicUrl(): string {
    return `/public/${this.filePath}`;
  }
}

export default Sticker;
