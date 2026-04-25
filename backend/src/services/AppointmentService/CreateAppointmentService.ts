import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentParticipant from "../../models/AppointmentParticipant";
import User from "../../models/User";
import { isElevatedProfile } from "./appointmentPermissions";
import {
  assertEventDateOrder,
  normalizeParticipantUserIds
} from "./appointmentValidation";
import sequelize from "../../database";
import { getIO } from "../../libs/socket";
import { buildAppointmentResponse } from "./loadAppointmentForApi";
import { logger } from "../../utils/logger";

type Visibility = "private" | "team" | "company";

type Data = {
  companyId: number;
  userId: number;
  profile: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
  isCollective: boolean;
  visibility: Visibility;
  participantUserIds?: number[];
};

const CreateAppointmentService = async (
  data: Data
): Promise<Record<string, unknown>> => {
  const {
    companyId,
    userId,
    profile,
    title,
    description,
    startAt,
    endAt,
    allDay = false,
    isCollective,
    visibility,
    participantUserIds = []
  } = data;

  if (!title || String(title).trim() === "") {
    throw new AppError("Título é obrigatório.", 400);
  }
  assertEventDateOrder(startAt, endAt);

  const allowed: Visibility[] = ["private", "team", "company"];
  if (!allowed.includes(visibility)) {
    throw new AppError("Visibilidade inválida.", 400);
  }

  const elevated = isElevatedProfile(profile);

  if (isCollective) {
    if (!elevated) {
      throw new AppError("Apenas supervisores e administradores podem criar eventos coletivos.", 403);
    }
  } else {
    if (visibility !== "private") {
      throw new AppError("Evento individual deve ser privado.", 400);
    }
  }

  if (isCollective && visibility === "private" && (!participantUserIds || participantUserIds.length === 0)) {
    throw new AppError("Inclua ao menos um participante para evento coletivo privado.", 400);
  }

  const uniqueParticipantIds = normalizeParticipantUserIds(participantUserIds, userId);

  let fullRecord: Record<string, unknown> | null = null;

  await sequelize.transaction(async (t: Transaction) => {
    if (uniqueParticipantIds.length > 0) {
      const users = await User.findAll({
        where: { id: uniqueParticipantIds, companyId },
        attributes: ["id"],
        transaction: t
      });
      if (users.length !== uniqueParticipantIds.length) {
        throw new AppError("Participantes devem pertencer à mesma empresa.", 400);
      }
    }

    const appointment = await Appointment.create(
      {
        title: String(title).trim(),
        description: description != null ? String(description) : null,
        startAt,
        endAt,
        allDay: Boolean(allDay),
        companyId,
        createdBy: userId,
        isCollective,
        visibility
      },
      { transaction: t }
    );

    if (isCollective && (uniqueParticipantIds.length > 0 || visibility === "company" || visibility === "team")) {
      const rows: { appointmentId: number; userId: number; status: "pending" }[] = uniqueParticipantIds.map(
        uid => ({
          appointmentId: appointment.id,
          userId: uid,
          status: "pending" as const
        })
      );
      if (rows.length > 0) {
        await AppointmentParticipant.bulkCreate(rows, { transaction: t });
      }
    }

    const built = await buildAppointmentResponse(appointment.id, { transaction: t });
    fullRecord = built;
  });

  if (!fullRecord) {
    throw new AppError("Erro ao criar compromisso.", 500);
  }

  const payload = { action: "created", record: fullRecord };
  try {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-appointment`, payload);
    if (isCollective && uniqueParticipantIds.length > 0) {
      for (const pid of uniqueParticipantIds) {
        io.to(`user-${pid}`).emit(`company-${companyId}-appointment`, payload);
      }
    }
  } catch (e) {
    logger.warn(
      { err: e, companyId, appointmentId: (fullRecord as { id?: number }).id },
      "CreateAppointment: socket emit falhou; compromisso já gravado."
    );
  }

  return fullRecord;
};

export default CreateAppointmentService;
