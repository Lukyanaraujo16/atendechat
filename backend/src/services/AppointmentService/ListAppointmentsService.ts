import { Op, Sequelize } from "sequelize";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";
import { buildAppointmentListAccessSqlLiteral } from "../../utils/sqlIdentifier";

type Params = {
  companyId: number;
  userId: number;
  start: Date;
  end: Date;
  /** Só admin/supervisor: restringe a compromissos criados por este usuário */
  createdByFilter?: number;
};

const ListAppointmentsService = async ({
  companyId,
  userId,
  start,
  end,
  createdByFilter
}: Params): Promise<Appointment[]> => {
  const cId = Number(companyId);
  const andParts: any[] = [
    { companyId: cId },
    { startAt: { [Op.lt]: end } },
    { endAt: { [Op.gt]: start } },
    Sequelize.literal(buildAppointmentListAccessSqlLiteral(userId))
  ];

  if (createdByFilter != null) {
    andParts.push({ createdBy: Number(createdByFilter) });
  }

  // Sequelize 5 (este projeto) não suporta `separate: true` — includes aninhados
  // (hasMany + user) com MySQL resultam muitas vezes em 500. Criador em JOIN; participantes
  // numa segunda query e anexados ao modelo.
  const rows = await Appointment.findAll({
    where: { [Op.and]: andParts },
    include: [
      { model: User, as: "creator", attributes: ["id", "name", "email"] }
    ],
    order: [["startAt", "ASC"]]
  });

  const appointmentIds = rows.map(r => r.id);
  if (appointmentIds.length === 0) {
    return rows;
  }

  const participants = await AppointmentParticipant.findAll({
    where: { appointmentId: { [Op.in]: appointmentIds } },
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email"] }
    ],
    order: [
      ["appointmentId", "ASC"],
      ["id", "ASC"]
    ]
  });
  const byAppt = new Map<number, AppointmentParticipant[]>();
  for (const p of participants) {
    const list = byAppt.get(p.appointmentId) || [];
    list.push(p);
    byAppt.set(p.appointmentId, list);
  }
  for (const a of rows) {
    a.setDataValue("participants", byAppt.get(a.id) || []);
  }
  return rows;
};

export default ListAppointmentsService;
