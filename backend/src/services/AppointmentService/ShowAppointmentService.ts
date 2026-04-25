import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import userCanViewAppointment from "./appointmentAccess";
import { buildAppointmentResponse } from "./loadAppointmentForApi";

const ShowAppointmentService = async (
  id: number,
  companyId: number,
  viewerId: number
): Promise<Record<string, unknown>> => {
  const a = await Appointment.findOne({ where: { id, companyId } });
  if (!a) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(a, viewerId))) {
    throw new AppError("Sem permissão para ver este compromisso.", 403);
  }
  const out = await buildAppointmentResponse(id, { companyId });
  if (!out) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  return out;
};

export default ShowAppointmentService;
