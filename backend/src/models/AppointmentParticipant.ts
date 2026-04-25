import {
  Table,
  Column,
  CreatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default
} from "sequelize-typescript";
import Appointment from "./Appointment";
import User from "./User";

export type ParticipantStatus = "pending" | "accepted" | "declined";

@Table({
  tableName: "AppointmentParticipants",
  /* Migração só cria "createdAt"; sem esta flag o Sequelize (PG/MySQL) pede "updatedAt" e falha. */
  updatedAt: false
})
class AppointmentParticipant extends Model<AppointmentParticipant> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Appointment)
  @Column
  appointmentId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @Default("pending")
  @Column(DataType.STRING(16))
  status: ParticipantStatus;

  @BelongsTo(() => Appointment, { foreignKey: "appointmentId", as: "appointment" })
  appointment: Appointment;

  @BelongsTo(() => User, { foreignKey: "userId", as: "user" })
  user: User;

  @CreatedAt
  createdAt: Date;
}

export default AppointmentParticipant;
