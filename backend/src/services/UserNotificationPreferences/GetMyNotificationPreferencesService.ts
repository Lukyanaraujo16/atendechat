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

export type MyNotificationPreferences = EffectivePushPreferences &
  EffectiveInAppPreferences;

function prefsWhere(userId: number, companyId: number | null) {
  if (companyId != null && companyId > 0) {
    return { userId, companyId };
  }
  return { userId, companyId: { [Op.is]: null } };
}

const GetMyNotificationPreferencesService = async (
  userId: number,
  companyId: number | null
): Promise<MyNotificationPreferences> => {
  const base: MyNotificationPreferences = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...DEFAULT_IN_APP_PREFERENCES
  };
  const row = await UserNotificationPreferences.findOne({
    where: prefsWhere(userId, companyId)
  });
  if (!row) {
    return base;
  }
  return {
    pushEnabled: row.pushEnabled,
    notifyNewTickets: row.notifyNewTickets,
    notifyAssignedTickets: row.notifyAssignedTickets,
    notifyTicketMessages: row.notifyTicketMessages,
    notifyTicketTransfers: row.notifyTicketTransfers,
    inAppEnabled: row.inAppEnabled,
    inAppNewTickets: row.inAppNewTickets,
    inAppAssignedTickets: row.inAppAssignedTickets,
    inAppTicketMessages: row.inAppTicketMessages,
    inAppTicketTransfers: row.inAppTicketTransfers,
    inAppAgenda: row.inAppAgenda,
    inAppBilling: row.inAppBilling
  };
};

export default GetMyNotificationPreferencesService;
