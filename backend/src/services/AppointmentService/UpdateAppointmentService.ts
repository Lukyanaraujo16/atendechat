import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";
import userCanViewAppointment from "./appointmentAccess";
import { isElevatedProfile } from "./appointmentPermissions";
import {
  assertEventDateOrder,
  normalizeParticipantUserIds
} from "./appointmentValidation";
import sequelize from "../../database";
import { getIO } from "../../libs/socket";
import { buildAppointmentResponse } from "./loadAppointmentForApi";
import { logger } from "../../utils/logger";
import { notifyAppointmentParticipantsUpdated } from "./appointmentInAppNotifications";

type Data = {
  id: number;
  companyId: number;
  userId: number;
  profile: string;
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  participantUserIds?: number[] | null;
  color?: string | null;
};

const canEdit = (a: Appointment, userId: number, profile: string) => {
  if (a.createdBy === userId) return true;
  if (isElevatedProfile(profile) && a.isCollective) return true;
  return false;
};

const UpdateAppointmentService = async (
  data: Data
): Promise<Record<string, unknown>> => {
  const { id, companyId, userId, profile, participantUserIds, color } = data;
  const appointment = await Appointment.findByPk(id);
  if (!appointment || appointment.companyId !== companyId) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(appointment, userId))) {
    throw new AppError("Sem permissão.", 403);
  }
  if (!canEdit(appointment, userId, profile)) {
    throw new AppError("Sem permissão para editar.", 403);
  }

  let fullRecord: Record<string, unknown> | null = null;

  await sequelize.transaction(async (t: Transaction) => {
    if (data.title != null) appointment.title = String(data.title).trim();
    if (data.description !== undefined) {
      appointment.description =
        data.description != null ? String(data.description) : null;
    }
    if (data.startAt) appointment.startAt = data.startAt;
    if (data.endAt) appointment.endAt = data.endAt;
    if (data.allDay !== undefined) appointment.allDay = Boolean(data.allDay);
    if (color !== undefined) {
      appointment.color = color;
    }
    if (data.startAt != null || data.endAt != null) {
      assertEventDateOrder(appointment.startAt, appointment.endAt);
    }
    await appointment.save({ transaction: t });

    if (
      appointment.isCollective &&
      isElevatedProfile(profile) &&
      participantUserIds !== undefined
    ) {
      const unique = normalizeParticipantUserIds(
        participantUserIds,
        appointment.createdBy
      );
      if (appointment.visibility === "private" && unique.length === 0) {
        throw new AppError("Inclua ao menos um participante.", 400);
      }
      if (unique.length > 0) {
        const users = await User.findAll({
          where: { id: unique, companyId },
          attributes: ["id"],
          transaction: t
        });
        if (users.length !== unique.length) {
          throw new AppError("Participantes inválidos.", 400);
        }
      }
      await AppointmentParticipant.destroy({
        where: { appointmentId: appointment.id },
        transaction: t
      });
      if (unique.length > 0) {
        await AppointmentParticipant.bulkCreate(
          unique.map(uid => ({
            appointmentId: appointment.id,
            userId: uid,
            status: "pending" as const
          })),
          { transaction: t }
        );
      }
    }

    const full = await buildAppointmentResponse(appointment.id, {
      transaction: t
    });
    if (!full) {
      throw new AppError("Compromisso não encontrado após atualizar.", 500);
    }
    fullRecord = full;
  });

  if (!fullRecord) {
    throw new AppError("Compromisso não encontrado após atualizar.", 500);
  }

  const payload = { action: "updated", record: fullRecord };
  try {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(
      `company-${companyId}-appointment`,
      payload
    );
  } catch (e) {
    logger.warn(
      { err: e, companyId, appointmentId: appointment.id },
      "UpdateAppointment: socket emit falhou; compromisso já atualizado."
    );
  }

  if (appointment.isCollective) {
    const parts = await AppointmentParticipant.findAll({
      where: { appointmentId: appointment.id },
      attributes: ["userId"]
    });
    const pids = parts.map(p => p.userId);
    if (pids.length) {
      await notifyAppointmentParticipantsUpdated({
        companyId,
        appointmentId: appointment.id,
        title: appointment.title,
        participantUserIds: pids,
        editorUserId: userId
      });
    }
  }

  return fullRecord;
};

export default UpdateAppointmentService;
