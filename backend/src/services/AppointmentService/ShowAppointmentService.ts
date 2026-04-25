import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import userCanViewAppointment from "./appointmentAccess";
import { findAppointmentForApi } from "./loadAppointmentForApi";

const ShowAppointmentService = async (
  id: number,
  companyId: number,
  viewerId: number
): Promise<Appointment> => {
  const appointment = await findAppointmentForApi(id, { companyId });
  if (!appointment) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(appointment, viewerId))) {
    throw new AppError("Sem permissão para ver este compromisso.", 403);
  }
  return appointment;
};

export default ShowAppointmentService;
