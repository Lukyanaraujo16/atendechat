import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import { refreshActiveTicketView } from "../libs/cache";
import { logger } from "../utils/logger";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";
import ListTicketsWithoutConnectionService from "../services/TicketServices/ListTicketsWithoutConnectionService";
import BulkAssignTicketsWhatsappService from "../services/TicketServices/BulkAssignTicketsWhatsappService";
import ReassignOrphanTicketWhatsappService from "../services/TicketServices/ReassignOrphanTicketWhatsappService";
import {
  toCompanyTicketAudience,
  toCompanyTicketDeleteAudience
} from "../helpers/companyTicketSocket";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  updatedAt?: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  tags: string;
  users: string;
  isGroup: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  whatsappId: string;
  useIntegration: boolean;
  promptId: number;
  integrationId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    isGroup
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    companyId,
    isGroup
  });
  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId, whatsappId }: TicketData = req.body;
  const { companyId } = req.user;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    companyId,
    queueId,
    whatsappId
  });

  const io = getIO();
  toCompanyTicketAudience(io, companyId, {
    id: ticket.id,
    status: ticket.status,
    queueId: ticket.queueId,
    userId: ticket.userId
  }).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket
  });
  return res.status(200).json(ticket);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;


  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    companyId

  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowTicketService(ticketId, companyId);
  return res.status(200).json(contact);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;

  const ticket: Ticket = await ShowTicketUUIDService(uuid);

  return res.status(200).json(ticket);
};

export const reassignWhatsapp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { whatsappId } = req.body as { whatsappId?: number | string };
  const { companyId, id } = req.user;

  if (whatsappId === undefined || whatsappId === null || `${whatsappId}`.trim() === "") {
    return res.status(400).json({ error: "ERR_INVALID_BODY" });
  }

  const ticket = await ReassignOrphanTicketWhatsappService({
    ticketId: Number(ticketId),
    companyId,
    newWhatsappId: Number(whatsappId),
    actionUserId: id
  });

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId, id} = req.user;

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId,
    companyId,
    actionUserId: id
  });


  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  await ShowTicketService(ticketId, companyId);

  const ticket = await DeleteTicketService(ticketId, companyId);

  const io = getIO();
  toCompanyTicketDeleteAudience(io, companyId, {
    id: +ticketId,
    status: ticket.status,
    queueId: ticket.queueId
  }).emit(`company-${companyId}-ticket`, {
    action: "delete",
    ticketId: +ticketId
  });

  return res.status(200).json({ message: "ticket deleted" });
};

export const listWithoutConnection = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketIds, count } = await ListTicketsWithoutConnectionService({ companyId });
  return res.status(200).json({ ticketIds, count });
};

export const bulkAssignConnection = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.user;
  const { whatsappId, ticketIds } = req.body as { whatsappId: number; ticketIds: number[] };
  if (!whatsappId || !Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ error: "whatsappId and ticketIds (non-empty) are required" });
  }
  const { updated } = await BulkAssignTicketsWhatsappService({
    companyId,
    ticketIds,
    whatsappId: Number(whatsappId),
    actionUserId: id
  });
  return res.status(200).json({ updated });
};

/** Heartbeat: utilizador com ticket aberto e visível (Fase 4 — filtro de push). */
export const registerActiveView = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const companyId = req.user.companyId;
  if (companyId == null || Number.isNaN(Number(companyId))) {
    throw new AppError("ERR_NO_COMPANY_CONTEXT", 400);
  }
  const tid = Number(ticketId);
  if (Number.isNaN(tid) || tid < 1) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }
  const ticket = await Ticket.findByPk(tid, {
    attributes: ["id", "companyId"]
  });
  if (!ticket || ticket.companyId !== companyId) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }
  try {
    await refreshActiveTicketView(companyId, tid, Number(req.user.id), 55);
  } catch (err) {
    logger.warn(
      { err, companyId, ticketId: tid },
      "[OneSignalPush] active_view_refresh_failed"
    );
  }
  return res.status(204).send();
};
