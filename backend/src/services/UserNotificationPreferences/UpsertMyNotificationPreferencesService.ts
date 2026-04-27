import { Op } from "sequelize";
import UserNotificationPreferences from "../../models/UserNotificationPreferences";
import {
  DEFAULT_PUSH_PREFERENCES,
  EffectivePushPreferences
} from "../OneSignalPush/userPushPreferences";
import {
  DEFAULT_IN_APP_PREFERENCES,
  EffectiveInAppPreferences
} from "../OneSignalPush/inAppPreferences";
import { MyNotificationPreferences } from "./GetMyNotificationPreferencesService";

export type UpsertBody = Partial<{
  pushEnabled: boolean;
  notifyNewTickets: boolean;
  notifyAssignedTickets: boolean;
  notifyTicketMessages: boolean;
  notifyTicketTransfers: boolean;
  inAppEnabled: boolean;
  inAppNewTickets: boolean;
  inAppAssignedTickets: boolean;
  inAppTicketMessages: boolean;
  inAppTicketTransfers: boolean;
  inAppAgenda: boolean;
  inAppBilling: boolean;
}>;

function prefsWhere(userId: number, companyId: number | null) {
  if (companyId != null && companyId > 0) {
    return { userId, companyId };
  }
  return { userId, companyId: { [Op.is]: null } };
}

const UpsertMyNotificationPreferencesService = async (
  userId: number,
  companyId: number | null,
  body: UpsertBody
): Promise<MyNotificationPreferences> => {
  const basePush: EffectivePushPreferences = { ...DEFAULT_PUSH_PREFERENCES };
  const baseInApp: EffectiveInAppPreferences = { ...DEFAULT_IN_APP_PREFERENCES };
  const existing = await UserNotificationPreferences.findOne({
    where: prefsWhere(userId, companyId)
  });
  if (existing) {
    basePush.pushEnabled = existing.pushEnabled;
    basePush.notifyNewTickets = existing.notifyNewTickets;
    basePush.notifyAssignedTickets = existing.notifyAssignedTickets;
    basePush.notifyTicketMessages = existing.notifyTicketMessages;
    basePush.notifyTicketTransfers = existing.notifyTicketTransfers;
    baseInApp.inAppEnabled = existing.inAppEnabled;
    baseInApp.inAppNewTickets = existing.inAppNewTickets;
    baseInApp.inAppAssignedTickets = existing.inAppAssignedTickets;
    baseInApp.inAppTicketMessages = existing.inAppTicketMessages;
    baseInApp.inAppTicketTransfers = existing.inAppTicketTransfers;
    baseInApp.inAppAgenda = existing.inAppAgenda;
    baseInApp.inAppBilling = existing.inAppBilling;
  }

  const next: MyNotificationPreferences = {
    pushEnabled:
      typeof body.pushEnabled === "boolean"
        ? body.pushEnabled
        : basePush.pushEnabled,
    notifyNewTickets:
      typeof body.notifyNewTickets === "boolean"
        ? body.notifyNewTickets
        : basePush.notifyNewTickets,
    notifyAssignedTickets:
      typeof body.notifyAssignedTickets === "boolean"
        ? body.notifyAssignedTickets
        : basePush.notifyAssignedTickets,
    notifyTicketMessages:
      typeof body.notifyTicketMessages === "boolean"
        ? body.notifyTicketMessages
        : basePush.notifyTicketMessages,
    notifyTicketTransfers:
      typeof body.notifyTicketTransfers === "boolean"
        ? body.notifyTicketTransfers
        : basePush.notifyTicketTransfers,
    inAppEnabled:
      typeof body.inAppEnabled === "boolean"
        ? body.inAppEnabled
        : baseInApp.inAppEnabled,
    inAppNewTickets:
      typeof body.inAppNewTickets === "boolean"
        ? body.inAppNewTickets
        : baseInApp.inAppNewTickets,
    inAppAssignedTickets:
      typeof body.inAppAssignedTickets === "boolean"
        ? body.inAppAssignedTickets
        : baseInApp.inAppAssignedTickets,
    inAppTicketMessages:
      typeof body.inAppTicketMessages === "boolean"
        ? body.inAppTicketMessages
        : baseInApp.inAppTicketMessages,
    inAppTicketTransfers:
      typeof body.inAppTicketTransfers === "boolean"
        ? body.inAppTicketTransfers
        : baseInApp.inAppTicketTransfers,
    inAppAgenda:
      typeof body.inAppAgenda === "boolean"
        ? body.inAppAgenda
        : baseInApp.inAppAgenda,
    inAppBilling:
      typeof body.inAppBilling === "boolean"
        ? body.inAppBilling
        : baseInApp.inAppBilling
  };

  if (existing) {
    await existing.update({
      pushEnabled: next.pushEnabled,
      notifyNewTickets: next.notifyNewTickets,
      notifyAssignedTickets: next.notifyAssignedTickets,
      notifyTicketMessages: next.notifyTicketMessages,
      notifyTicketTransfers: next.notifyTicketTransfers,
      inAppEnabled: next.inAppEnabled,
      inAppNewTickets: next.inAppNewTickets,
      inAppAssignedTickets: next.inAppAssignedTickets,
      inAppTicketMessages: next.inAppTicketMessages,
      inAppTicketTransfers: next.inAppTicketTransfers,
      inAppAgenda: next.inAppAgenda,
      inAppBilling: next.inAppBilling
    });
  } else {
    await UserNotificationPreferences.create({
      userId,
      companyId,
      pushEnabled: next.pushEnabled,
      notifyNewTickets: next.notifyNewTickets,
      notifyAssignedTickets: next.notifyAssignedTickets,
      notifyTicketMessages: next.notifyTicketMessages,
      notifyTicketTransfers: next.notifyTicketTransfers,
      inAppEnabled: next.inAppEnabled,
      inAppNewTickets: next.inAppNewTickets,
      inAppAssignedTickets: next.inAppAssignedTickets,
      inAppTicketMessages: next.inAppTicketMessages,
      inAppTicketTransfers: next.inAppTicketTransfers,
      inAppAgenda: next.inAppAgenda,
      inAppBilling: next.inAppBilling
    });
  }

  return next;
};

export default UpsertMyNotificationPreferencesService;
