import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListUserNotificationsService from "../services/UserNotificationService/ListUserNotificationsService";
import MarkUserNotificationReadService from "../services/UserNotificationService/MarkUserNotificationReadService";
import MarkAllUserNotificationsReadService from "../services/UserNotificationService/MarkAllUserNotificationsReadService";
import MarkManyUserNotificationsReadService from "../services/UserNotificationService/MarkManyUserNotificationsReadService";
import CountUnreadUserNotificationsService from "../services/UserNotificationService/CountUnreadUserNotificationsService";
import ArchiveUserNotificationService from "../services/UserNotificationService/ArchiveUserNotificationService";
import ArchiveAllReadUserNotificationsService from "../services/UserNotificationService/ArchiveAllReadUserNotificationsService";
import ArchiveManyUserNotificationsService from "../services/UserNotificationService/ArchiveManyUserNotificationsService";
import {
  assertTenantCompany,
  loadNotificationRequestContext
} from "../services/UserNotificationService/notificationRequestContext";
import { NotificationListFilters } from "../services/UserNotificationService/notificationWhere";

async function loadCtx(req: Request) {
  const ctx = await loadNotificationRequestContext(req);
  if (!ctx.isSuper) {
    assertTenantCompany(ctx);
  }
  return ctx;
}

export const unreadCount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const count = await CountUnreadUserNotificationsService(ctx);
  return res.json({ count });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const ctx = await loadCtx(req);
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20)
  );
  const readQ = req.query.read as string | undefined;
  let readFilter: boolean | undefined;
  if (readQ === "true") readFilter = true;
  else if (readQ === "false") readFilter = false;

  const archivedQ = String(req.query.archived || "default").toLowerCase();
  let archived: NotificationListFilters["archived"] = "default";
  if (archivedQ === "only" || archivedQ === "archived") archived = "only";
  else if (archivedQ === "all") archived = "all";

  const kindQ = String(req.query.kind || "").toLowerCase();
  let kind: NotificationListFilters["kind"];
  if (kindQ === "ticket") kind = "ticket";
  else if (kindQ === "appointment") kind = "appointment";
  else if (kindQ === "billing") kind = "billing";

  const search =
    typeof req.query.q === "string"
      ? req.query.q
      : typeof req.query.search === "string"
        ? req.query.search
        : undefined;

  const filters: NotificationListFilters = {
    readFilter,
    archived,
    ...(kind ? { kind } : {}),
    ...(search != null && search.trim() !== "" ? { search: search.trim() } : {})
  };

  const { notifications, count, hasMore } = await ListUserNotificationsService({
    ctx,
    page,
    limit,
    filters
  });

  return res.json({
    notifications: notifications.map(n => n.get({ plain: true })),
    count,
    hasMore,
    page,
    limit
  });
};

export const markRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new AppError("ERR_INVALID_ID", 400);
  }
  const row = await MarkUserNotificationReadService(id, ctx);
  if (!row) {
    throw new AppError("ERR_NO_NOTIFICATION", 404);
  }
  return res.json(row.get({ plain: true }));
};

export const markAllRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const updated = await MarkAllUserNotificationsReadService(ctx);
  return res.json({ updated });
};

export const markManyRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const raw = (req.body && req.body.ids) as unknown;
  const ids = Array.isArray(raw) ? raw : [];
  const updated = await MarkManyUserNotificationsReadService(ids, ctx);
  return res.json({ updated });
};

export const archiveOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new AppError("ERR_INVALID_ID", 400);
  }
  const row = await ArchiveUserNotificationService(id, ctx);
  if (!row) {
    throw new AppError("ERR_NO_NOTIFICATION", 404);
  }
  return res.json(row.get({ plain: true }));
};

export const archiveAllRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const archived = await ArchiveAllReadUserNotificationsService(ctx);
  return res.json({ archived });
};

export const archiveMany = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ctx = await loadCtx(req);
  const raw = (req.body && req.body.ids) as unknown;
  const ids = Array.isArray(raw) ? raw : [];
  const archived = await ArchiveManyUserNotificationsService(ids, ctx);
  return res.json({ archived });
};
