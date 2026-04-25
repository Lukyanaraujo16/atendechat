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

  // `separate: true` no hasMany: sem isto, o Sequelize aplica a cláusula de acesso
  // (literal) dentro de subqueries/joins a `User` e `UserQueues`, o que no MySQL
  // gera 500 (coluna/alias inexistente ou subquery inválida).
  return Appointment.findAll({
    subQuery: false,
    where: { [Op.and]: andParts },
    include: [
      {
        model: AppointmentParticipant,
        as: "participants",
        required: false,
        separate: true,
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email"] }
        ]
      },
      { model: User, as: "creator", attributes: ["id", "name", "email"] }
    ],
    order: [["startAt", "ASC"]]
  });
};

export default ListAppointmentsService;
