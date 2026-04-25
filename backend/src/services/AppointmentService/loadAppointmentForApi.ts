import { Transaction } from "sequelize";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";

const creatorInclude = {
  model: User,
  as: "creator" as const,
  attributes: ["id", "name", "email"]
};

const userOnParticipant = {
  model: User,
  as: "user" as const,
  attributes: ["id", "name", "email"]
};

/**
 * Sequelize 5.x (este projeto) não suporta `separate: true` em includes. O efeito
 * costuma ser 500 (SQL inválido) em findByPk/findOne com hasMany+BelongsTo aninhados
 * (MySQL). Aqui: duas consultas previsíveis e junção no modelo.
 */
export const attachParticipantsToAppointment = async (
  appointment: Appointment,
  options: { transaction?: Transaction } = {}
): Promise<Appointment> => {
  const rows = await AppointmentParticipant.findAll({
    where: { appointmentId: appointment.id },
    include: [userOnParticipant],
    order: [["id", "ASC"]],
    ...options
  });
  (appointment as any).setDataValue("participants", rows);
  return appointment;
};

type FindOpts = { transaction?: Transaction; companyId?: number };

/**
 * Carrega um compromisso com criador + participantes (e user de cada participante).
 * Preferir isto a findByPk com include aninhado em MySQL/Sequelize 5.
 */
export const findAppointmentForApi = async (
  id: number,
  options: FindOpts = {}
): Promise<Appointment | null> => {
  const { transaction, companyId } = options;
  const where: { id: number; companyId?: number } = { id };
  if (companyId !== undefined) {
    where.companyId = companyId;
  }
  const a = await Appointment.findOne({
    where,
    include: [creatorInclude],
    transaction
  });
  if (!a) {
    return null;
  }
  return attachParticipantsToAppointment(a, { transaction });
};
