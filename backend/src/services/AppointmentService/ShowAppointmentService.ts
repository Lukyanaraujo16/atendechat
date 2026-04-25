import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";
import userCanViewAppointment from "./appointmentAccess";

const ShowAppointmentService = async (
  id: number,
  companyId: number,
  viewerId: number
): Promise<Appointment> => {
  const appointment = await Appointment.findOne({
    where: { id, companyId },
    include: [
      {
        model: AppointmentParticipant,
        as: "participants",
        required: false,
        include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }]
      },
      { model: User, as: "creator", attributes: ["id", "name", "email"] }
    ]
  });
  if (!appointment) {
    throw new AppError("Compromisso não encontrado.", 404);
  }
  if (!(await userCanViewAppointment(appointment, viewerId))) {
    throw new AppError("Sem permissão para ver este compromisso.", 403);
  }
  return appointment;
};

export default ShowAppointmentService;
