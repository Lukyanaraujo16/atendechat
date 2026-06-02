import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import { refreshActiveTicketView } from "../libs/cache";
import { logger } from "../utils/logger";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import BatchDeleteTicketsService from "../services/TicketServices/BatchDeleteTicketsService";
import { userCanDeleteTicket } from "../helpers/canDeleteTicket";
import { assertTicketAccess } from "../helpers/ticketAccess";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import attachContactLabelsToTickets from "../helpers/attachContactLabelsToTickets";
import { parseArrayQueryParam } from "../utils/parseArrayQueryParam";
import {
  getOpenTicketElapsedMs,
  getOpenTicketEnrichDebug,
  getOpenTicketEnrichWarnings
} from "../helpers/openTicketRequestContext";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";
import ListTicketsWithoutConnectionService from "../services/TicketServices/ListTicketsWithoutConnectionService";
import BulkAssignTicketsWhatsappService from "../services/TicketServices/BulkAssignTicketsWhatsappService";
import ReassignOrphanTicketWhatsappService from "../services/TicketServices/ReassignOrphanTicketWhatsappService";
import ListPinnedTicketsService from "../services/PinnedTicketServices/ListPinnedTicketsService";
import PinTicketService from "../services/PinnedTicketServices/PinTicketService";
import UnpinTicketService from "../services/PinnedTicketServices/UnpinTicketService";
import {
  toCompanyTicketAudience,
  toCompanyTicketDeleteAudience
} from "../helpers/companyTicketSocket";
import { assertUserCanAccessGroupContact } from "../helpers/groupVisibility";

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
  contactLabels: string;
  users: string;
  isGroup: string;
  chatbot: string;
  countOnly: string;
  closedPeriod: string;
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
    contactLabels: contactLabelIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    isGroup,
    chatbot,
    countOnly
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId, profile, supportMode } = req.user;

  const queueIds = parseArrayQueryParam(queueIdsStringified);
  const tagsIds = parseArrayQueryParam(tagIdsStringified);
  const contactLabelIds = parseArrayQueryParam(contactLabelIdsStringified);
  const usersIds = parseArrayQueryParam(userIdsStringified);

  const normalizedSearch =
    searchParam != null && String(searchParam).trim() !== ""
      ? String(searchParam).trim()
      : undefined;

  try {
    const { tickets, count, hasMore } = await ListTicketsService({
      searchParam: normalizedSearch,
      tags: tagsIds,
      contactLabels: contactLabelIds,
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
      isGroup,
      chatbot,
      countOnly,
      userProfile: profile,
      supportMode
    });
    await attachContactLabelsToTickets(tickets, companyId);

    return res.status(200).json({ tickets, count, hasMore });
  } catch (error) {
    const err = error as {
      message?: string;
      name?: string;
      parent?: {
        code?: string;
        errno?: number;
        sqlMessage?: string;
        sql?: string;
      };
      original?: {
        code?: string;
        errno?: number;
        sqlMessage?: string;
        sql?: string;
      };
      stack?: string;
    };
    const parent = err?.parent || err?.original;

    logger.error(
      {
        tag: "[TicketController.index]",
        companyId,
        userId,
        status,
        searchParam: normalizedSearch ?? "",
        contactLabels: contactLabelIdsStringified ?? "",
        queueIds: queueIdsStringified ?? "",
        isGroup: isGroup ?? "",
        message: err?.message,
        name: err?.name,
        parent: parent
          ? {
              code: parent.code,
              errno: parent.errno,
              sqlMessage: parent.sqlMessage,
              sql: parent.sql
            }
          : undefined,
        stack: err?.stack
      },
      "[ListTicketsService] failed"
    );
    throw error;
  }
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
    withUnreadMessages,
    closedPeriod
  } = req.query as IndexQuery;


  const userId = req.user.id;
  const { companyId, profile, supportMode } = req.user;

  const queueIds = parseArrayQueryParam(queueIdsStringified);
  const tagsIds = parseArrayQueryParam(tagIdsStringified);
  const usersIds = parseArrayQueryParam(userIdsStringified);

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
    companyId,
    closedPeriod,
    userProfile: profile,
    supportMode

  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId, profile, supportMode, id } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);

  await assertTicketAccess(
    { id, profile, supportMode },
    {
      userId: ticket.userId,
      queueId: ticket.queueId,
      whatsappId: ticket.whatsappId,
      companyId: ticket.companyId,
      whatsapp: ticket.whatsapp as any
    },
    companyId
  );

  if (ticket.isGroup === true && ticket.contact) {
    await assertUserCanAccessGroupContact(ticket.contact as any, {
      id,
      profile,
      supportMode,
      companyId
    });
  }

  return res.status(200).json(ticket);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;
  const { profile, supportMode, companyId, id } = req.user;

  const logBase = { ticketUuid: uuid, companyId, userId: id };
  logger.info(logBase, "[OpenTicket] show-ticket start");

  let ticket: Ticket;
  try {
    ticket = await ShowTicketUUIDService(uuid);
    const enrichWarnings = getOpenTicketEnrichWarnings();
    const enrichDebug = getOpenTicketEnrichDebug();
    logger.info(
      {
        ...logBase,
        ticketId: ticket.id,
        elapsedMs: getOpenTicketElapsedMs(),
        enrichWarnings: enrichWarnings.length ? enrichWarnings : undefined,
        enrichDebug: enrichDebug.length ? enrichDebug : undefined
      },
      "[OpenTicket] show-ticket success"
    );
  } catch (error) {
    logger.error(
      {
        ...logBase,
        elapsedMs: getOpenTicketElapsedMs(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      "[OpenTicket] show-ticket failed"
    );
    throw error;
  }

  if (ticket.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await assertTicketAccess(
    { id, profile, supportMode },
    {
      userId: ticket.userId,
      queueId: ticket.queueId,
      whatsappId: ticket.whatsappId,
      companyId: ticket.companyId,
      whatsapp: (ticket as any).whatsapp
    },
    companyId
  );

  if ((ticket as any).isGroup === true && (ticket as any).contact) {
    await assertUserCanAccessGroupContact((ticket as any).contact, {
      id,
      profile,
      supportMode,
      companyId
    });
  }

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

  try {
    const ticket = await ReassignOrphanTicketWhatsappService({
      ticketId: Number(ticketId),
      companyId,
      newWhatsappId: Number(whatsappId),
      actionUserId: id
    });
    return res.status(200).json(ticket);
  } catch (err) {
    logger.warn(
      {
        err,
        ticketId: Number(ticketId),
        companyId,
        whatsappId
      },
      "[TicketMoveError] reassign-whatsapp failed"
    );
    throw err;
  }
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId, id, profile, supportMode } = req.user;

  const existing = await ShowTicketService(ticketId, companyId);
  await assertTicketAccess(
    { id, profile, supportMode },
    {
      userId: existing.userId,
      queueId: existing.queueId,
      whatsappId: existing.whatsappId,
      companyId: existing.companyId,
      whatsapp: existing.whatsapp as any
    },
    companyId
  );

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
  const { companyId, id: userId, profile, supportMode } = req.user;

  if (!userCanDeleteTicket({ profile, supportMode })) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  logger.info(
    { ticketId, companyId, userId, profile },
    "[TicketDelete] request"
  );

  const ticket = await DeleteTicketService(
    ticketId,
    companyId,
    userId != null ? Number(userId) : null
  );

  logger.info(
    { ticketId: +ticketId, companyId, status: ticket.status },
    "[TicketDelete] success"
  );

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

export const removeBatch = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId, profile, supportMode } = req.user;
  const { ticketIds } = req.body as { ticketIds?: unknown };

  if (!userCanDeleteTicket({ profile, supportMode })) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ error: "ticketIds must be a non-empty array" });
  }

  const ids = ticketIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    return res.status(400).json({ error: "ticketIds must contain valid numeric ids" });
  }

  logger.info(
    { ticketIds: ids, companyId, userId, count: ids.length },
    "[TicketDelete] batch request"
  );

  const { deleted, result } = await BatchDeleteTicketsService(
    ids,
    companyId,
    userId != null ? Number(userId) : null
  );

  logger.info(
    {
      companyId,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
      deletedIds: result.deletedIds,
      failedIds: result.failedIds
    },
    "[TicketDelete] batch success"
  );

  const io = getIO();
  for (const item of deleted) {
    toCompanyTicketDeleteAudience(io, companyId, {
      id: item.id,
      status: item.status,
      queueId: item.queueId
    }).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: item.id
    });
  }

  return res.status(200).json(result);
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

export const listPinned = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = Number(req.user.id);
  const companyId = Number(req.user.companyId);
  const pinned = await ListPinnedTicketsService({ userId, companyId });
  return res.status(200).json({ pinned });
};

export const pin = async (req: Request, res: Response): Promise<Response> => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }
  const userId = Number(req.user.id);
  const companyId = Number(req.user.companyId);
  const row = await PinTicketService({
    ticketId,
    userId,
    companyId,
    user: {
      id: req.user.id,
      profile: req.user.profile,
      supportMode: req.user.supportMode
    }
  });
  return res.status(200).json({
    ticketId: row.ticketId,
    createdAt: row.createdAt
  });
};

export const unpin = async (req: Request, res: Response): Promise<Response> => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }
  const userId = Number(req.user.id);
  const companyId = Number(req.user.companyId);
  await UnpinTicketService({
    ticketId,
    userId,
    companyId,
    user: {
      id: req.user.id,
      profile: req.user.profile,
      supportMode: req.user.supportMode
    }
  });
  return res.status(204).send();
};
