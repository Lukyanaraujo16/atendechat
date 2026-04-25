import { Op, Sequelize } from "sequelize";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";

type Params = {
  companyId: number;
  userId: number;
  start: Date;
  end: Date;
  /** Só admin/supervisor: restringe a compromissos criados por este usuário */
  createdByFilter?: number;
};

/** Alias Sequelize: FROM "Appointments" AS "Appointment" */
const buildAccessLiteral = (viewerId: number) => {
  const v = Number(viewerId);
  return `(
    "Appointment"."createdBy" = ${v}
    OR "Appointment"."visibility" = 'company'
    OR (
      "Appointment"."visibility" = 'team'
      AND EXISTS (
        SELECT 1 FROM "UserQueues" uq1
        INNER JOIN "UserQueues" uq2 ON uq1."queueId" = uq2."queueId"
        WHERE uq1."userId" = ${v} AND uq2."userId" = "Appointment"."createdBy"
      )
    )
    OR (
      "Appointment"."visibility" = 'private'
      AND "Appointment"."isCollective" = true
      AND EXISTS (
        SELECT 1 FROM "AppointmentParticipants" ap
        WHERE ap."appointmentId" = "Appointment"."id" AND ap."userId" = ${v}
      )
    )
  )`;
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
    Sequelize.literal(buildAccessLiteral(userId))
  ];

  if (createdByFilter != null) {
    andParts.push({ createdBy: Number(createdByFilter) });
  }

  return Appointment.findAll({
    where: { [Op.and]: andParts },
    include: [
      {
        model: AppointmentParticipant,
        as: "participants",
        required: false,
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
