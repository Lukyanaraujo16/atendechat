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

  // Sem includes/JOINs: só tabela Appointments; criador e participantes em queries com IN
  // (Sequelize 5 + MySQL gera 500 com BelongsTo/hasMany incluídos no mesmo list).
  const rows = await Appointment.findAll({
    where: { [Op.and]: andParts },
    order: [["startAt", "ASC"]]
  });

  const appointmentIds = rows.map(r => r.id);
  if (appointmentIds.length === 0) {
    return rows;
  }

  const rawParts = await AppointmentParticipant.findAll({
    where: { appointmentId: { [Op.in]: appointmentIds } },
    order: [
      ["appointmentId", "ASC"],
      ["id", "ASC"]
    ]
  });
  const uids = [...new Set(rawParts.map(p => p.userId))];
  const users = uids.length
    ? await User.findAll({
        where: { id: { [Op.in]: uids } },
        attributes: ["id", "name", "email"]
      })
    : [];
  const umap = new Map<number, Record<string, unknown>>(
    users.map(u => {
      const pl = u.get({ plain: true }) as Record<string, unknown> & { id: number };
      return [pl.id, pl];
    })
  );
  const withUser: Array<Record<string, unknown>> = rawParts.map(p => {
    const plain = p.get({ plain: true }) as Record<string, unknown>;
    return { ...plain, user: umap.get(p.userId) ?? null };
  });
  const byAppt = new Map<number, Array<Record<string, unknown>>>();
  for (const p of withUser) {
    const aid = p.appointmentId as number;
    if (!byAppt.has(aid)) byAppt.set(aid, []);
    byAppt.get(aid)!.push(p);
  }
  const creatorIds = [...new Set(rows.map(r => r.createdBy))];
  const creators = creatorIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: creatorIds } },
        attributes: ["id", "name", "email"]
      })
    : [];
  const creatormap = new Map<number, Record<string, unknown>>(
    creators.map(c => {
      const pl = c.get({ plain: true }) as Record<string, unknown> & { id: number };
      return [pl.id, pl];
    })
  );
  for (const a of rows) {
    a.setDataValue("participants", (byAppt.get(a.id) || []) as any);
    a.setDataValue("creator", (creatormap.get(a.createdBy) ?? null) as any);
  }
  return rows;
};

export default ListAppointmentsService;
