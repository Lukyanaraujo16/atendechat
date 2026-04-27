import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import { getIO } from "../../libs/socket";
import userCanViewAppointment from "./appointmentAccess";
import { isElevatedProfile } from "./appointmentPermissions";
import { notifyAppointmentParticipantsCancelled } from "./appointmentInAppNotifications";

const canDelete = (a: Appointment, userId: number, profile: string) => {
  if (a.createdBy === userId) return true;
  if (isElevatedProfile(profile) && a.isCollective) return true;
  return false;
};

const DeleteAppointmentService = async (
  id: number,
  companyId: number,
  userId: number,
  profile: string
): Promise<void> => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment || appointment.companyId !== companyId) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(appointment, userId))) {
    throw new AppError("Sem permissão.", 403);
  }
  if (!canDelete(appointment, userId, profile)) {
    throw new AppError("Sem permissão para excluir.", 403);
  }
  const participantRows = await AppointmentParticipant.findAll({
    where: { appointmentId: appointment.id },
    attributes: ["userId"]
  });
  const participantIds = participantRows.map(r => r.userId);
  if (appointment.isCollective && participantIds.length) {
    await notifyAppointmentParticipantsCancelled({
      companyId,
      appointmentId: appointment.id,
      title: appointment.title,
      participantUserIds: participantIds,
      deletedByUserId: userId
    });
  }
  const payload = { action: "deleted", id: appointment.id };
  await appointment.destroy();
  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-appointment`, payload);
};

export default DeleteAppointmentService;
