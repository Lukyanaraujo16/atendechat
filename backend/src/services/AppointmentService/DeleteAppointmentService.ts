import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import { getIO } from "../../libs/socket";
import userCanViewAppointment from "./appointmentAccess";
import { isElevatedProfile } from "./appointmentPermissions";

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
  const payload = { action: "deleted", id: appointment.id };
  await appointment.destroy();
  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-appointment`, payload);
};

export default DeleteAppointmentService;
