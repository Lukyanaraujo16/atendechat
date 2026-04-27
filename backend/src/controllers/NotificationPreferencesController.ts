import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetMyNotificationPreferencesService from "../services/UserNotificationPreferences/GetMyNotificationPreferencesService";
import UpsertMyNotificationPreferencesService from "../services/UserNotificationPreferences/UpsertMyNotificationPreferencesService";
import { resolveMyNotificationPreferencesScope } from "../services/UserNotificationPreferences/resolveMyNotificationPreferencesScope";

export const showMine = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const scope = await resolveMyNotificationPreferencesScope(req);
  const prefs = await GetMyNotificationPreferencesService(
    scope.userId,
    scope.companyId
  );
  return res.json({
    ...prefs,
    preferenceContext: {
      scope: scope.companyId == null ? "platform" : "tenant",
      companyId: scope.companyId
    }
  });
};

export const updateMine = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const scope = await resolveMyNotificationPreferencesScope(req);
  const body = req.body || {};
  if (body.companyId != null || body.preferenceScope != null) {
    throw new AppError("ERR_INVALID_BODY", 400);
  }
  const prefs = await UpsertMyNotificationPreferencesService(
    scope.userId,
    scope.companyId,
    {
      pushEnabled: body.pushEnabled,
      notifyNewTickets: body.notifyNewTickets,
      notifyAssignedTickets: body.notifyAssignedTickets,
      notifyTicketMessages: body.notifyTicketMessages,
      notifyTicketTransfers: body.notifyTicketTransfers,
      inAppEnabled: body.inAppEnabled,
      inAppNewTickets: body.inAppNewTickets,
      inAppAssignedTickets: body.inAppAssignedTickets,
      inAppTicketMessages: body.inAppTicketMessages,
      inAppTicketTransfers: body.inAppTicketTransfers,
      inAppAgenda: body.inAppAgenda,
      inAppBilling: body.inAppBilling
    }
  );
  return res.json({
    ...prefs,
    preferenceContext: {
      scope: scope.companyId == null ? "platform" : "tenant",
      companyId: scope.companyId
    }
  });
};
