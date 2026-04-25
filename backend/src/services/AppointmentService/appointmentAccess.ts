import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import UserQueue from "../../models/UserQueue";

/**
 * Verifica se o utilizador pode ver o compromisso (já com companyId alinhada).
 */
const userCanViewAppointment = async (
  a: Appointment,
  viewerId: number
): Promise<boolean> => {
  if (a.createdBy === viewerId) return true;
  if (a.visibility === "company") return true;
  if (a.visibility === "private" && a.isCollective) {
    const p = await AppointmentParticipant.findOne({
      where: { appointmentId: a.id, userId: viewerId }
    });
    return !!p;
  }
  if (a.visibility === "team") {
    const mine = await UserQueue.findAll({ where: { userId: viewerId } });
    const theirs = await UserQueue.findAll({ where: { userId: a.createdBy } });
    const myQueues = new Set(mine.map(x => x.queueId));
    for (const u of theirs) {
      if (myQueues.has(u.queueId)) return true;
    }
    return false;
  }
  return false;
};

export default userCanViewAppointment;
