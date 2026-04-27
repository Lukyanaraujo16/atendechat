import AppError from "../../errors/AppError";
import AppointmentParticipant, { ParticipantStatus } from "../../models/AppointmentParticipant";
import userCanViewAppointment from "./appointmentAccess";
import Appointment from "../../models/Appointment";
import User from "../../models/User";
import { notifyAppointmentCreatorOfResponse } from "./appointmentInAppNotifications";

const RespondAppointmentService = async (
  appointmentId: number,
  companyId: number,
  userId: number,
  status: ParticipantStatus
): Promise<AppointmentParticipant> => {
  if (!["accepted", "declined"].includes(status)) {
    throw new AppError("Status inválido. Use accepted ou declined.", 400);
  }
  const appointment = await Appointment.findByPk(appointmentId);
  if (!appointment || appointment.companyId !== companyId) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(appointment, userId))) {
    throw new AppError("Sem permissão.", 403);
  }
  const p = await AppointmentParticipant.findOne({
    where: { appointmentId, userId }
  });
  if (!p) {
    throw new AppError("Você não é participante deste compromisso.", 400);
  }
  p.status = status;
  await p.save();

  const responder = await User.findByPk(userId, { attributes: ["name"] });
  const responderName =
    responder?.name != null && String(responder.name).trim() !== ""
      ? String(responder.name).trim()
      : `Utilizador #${userId}`;
  await notifyAppointmentCreatorOfResponse({
    companyId,
    appointmentId,
    appointmentTitle: appointment.title,
    creatorUserId: appointment.createdBy,
    responderUserId: userId,
    responderName,
    status: status as "accepted" | "declined"
  });

  return p;
};

export default RespondAppointmentService;
