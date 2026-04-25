import { Request, Response } from "express";
import CreateAppointmentService from "../services/AppointmentService/CreateAppointmentService";
import ListAppointmentsService from "../services/AppointmentService/ListAppointmentsService";
import ShowAppointmentService from "../services/AppointmentService/ShowAppointmentService";
import UpdateAppointmentService from "../services/AppointmentService/UpdateAppointmentService";
import DeleteAppointmentService from "../services/AppointmentService/DeleteAppointmentService";
import RespondAppointmentService from "../services/AppointmentService/RespondAppointmentService";
import { isElevatedProfile } from "../services/AppointmentService/appointmentPermissions";
import {
  assertListDateRange,
  assertEventDateOrder,
  parseAppointmentInputDate
} from "../services/AppointmentService/appointmentValidation";
import { ParticipantStatus } from "../models/AppointmentParticipant";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId, profile } = req.user;
  const { start, end, createdBy: createdByQ } = req.query;
  if (start == null || String(start) === "" || end == null || String(end) === "") {
    return res.status(400).json({ error: "Parâmetros start e end (ISO) são obrigatórios." });
  }
  const startD = parseAppointmentInputDate(start, "start");
  const endD = parseAppointmentInputDate(end, "end");
  assertListDateRange(startD, endD);
  let createdByFilter: number | undefined;
  if (createdByQ != null && String(createdByQ) !== "") {
    if (!isElevatedProfile(profile)) {
      return res.status(403).json({ error: "Sem permissão para filtrar por criador." });
    }
    createdByFilter = Number(createdByQ);
    if (Number.isNaN(createdByFilter)) {
      return res.status(400).json({ error: "createdBy inválido." });
    }
  }
  const records = await ListAppointmentsService({
    companyId: Number(companyId),
    userId: Number(userId),
    start: startD,
    end: endD,
    createdByFilter
  });
  return res.json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId, profile } = req.user;
  const b = req.body;
  const startAt = parseAppointmentInputDate(b.startAt, "startAt");
  const endAt = parseAppointmentInputDate(b.endAt, "endAt");
  assertEventDateOrder(startAt, endAt);

  let isCollective = Boolean(b.isCollective);
  let visibility = b.visibility;
  if (!isElevatedProfile(profile)) {
    isCollective = false;
    visibility = "private";
  }

  const record = await CreateAppointmentService({
    companyId: Number(companyId),
    userId: Number(userId),
    profile,
    title: b.title,
    description: b.description,
    startAt,
    endAt,
    allDay: Boolean(b.allDay),
    isCollective,
    visibility,
    participantUserIds: Array.isArray(b.participantUserIds) ? b.participantUserIds : []
  });
  return res.status(201).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId } = req.user;
  const { id } = req.params;
  const record = await ShowAppointmentService(Number(id), Number(companyId), Number(userId));
  return res.json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId, profile } = req.user;
  const { id } = req.params;
  const b = req.body;
  const data: any = {
    id: Number(id),
    companyId: Number(companyId),
    userId: Number(userId),
    profile,
    title: b.title,
    description: b.description
  };
  if (b.startAt != null) {
    data.startAt = parseAppointmentInputDate(b.startAt, "startAt");
  }
  if (b.endAt != null) {
    data.endAt = parseAppointmentInputDate(b.endAt, "endAt");
  }
  if (b.allDay !== undefined) data.allDay = b.allDay;
  if (b.participantUserIds !== undefined) {
    if (!Array.isArray(b.participantUserIds)) {
      return res.status(400).json({ error: "participantUserIds deve ser um array." });
    }
    data.participantUserIds = b.participantUserIds;
  }
  const record = await UpdateAppointmentService(data);
  return res.json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId, profile } = req.user;
  const { id } = req.params;
  await DeleteAppointmentService(Number(id), Number(companyId), Number(userId), profile);
  return res.status(200).json({ message: "OK" });
};

export const respond = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId, companyId } = req.user;
  const { id } = req.params;
  const status = String(req.body?.status) as ParticipantStatus;
  const record = await RespondAppointmentService(
    Number(id),
    Number(companyId),
    Number(userId),
    status
  );
  return res.json(record);
};
