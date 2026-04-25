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
  DataType,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import AppointmentParticipant from "./AppointmentParticipant";

export type AppointmentVisibility = "private" | "team" | "company";

@Table({ tableName: "Appointments" })
class Appointment extends Model<Appointment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column(DataType.TEXT)
  description: string | null;

  @Column
  startAt: Date;

  @Column
  endAt: Date;

  @Default(false)
  @Column
  allDay: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @Column
  createdBy: number;

  @Default(false)
  @Column
  isCollective: boolean;

  @Default("private")
  @Column(DataType.STRING(32))
  visibility: AppointmentVisibility;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "creator" })
  creator: User;

  @HasMany(() => AppointmentParticipant, {
    foreignKey: "appointmentId",
    as: "participants"
  })
  participants: AppointmentParticipant[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Appointment;
