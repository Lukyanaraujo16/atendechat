import { Op } from "sequelize";
import UserNotificationPreferences from "../../models/UserNotificationPreferences";

export type PushPreferenceCategory =
  | "new_ticket"
  | "message"
  | "assigned"
  | "transfer";

export type EffectivePushPreferences = {
  pushEnabled: boolean;
  notifyNewTickets: boolean;
  notifyAssignedTickets: boolean;
  notifyTicketMessages: boolean;
  notifyTicketTransfers: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: EffectivePushPreferences = {
  pushEnabled: true,
  notifyNewTickets: true,
  notifyAssignedTickets: true,
  notifyTicketMessages: true,
  notifyTicketTransfers: true
};

function categoryAllowed(
  prefs: EffectivePushPreferences,
  category: PushPreferenceCategory
): boolean {
  if (!prefs.pushEnabled) {
    return false;
  }
  switch (category) {
    case "new_ticket":
      return prefs.notifyNewTickets;
    case "message":
      return prefs.notifyTicketMessages;
    case "assigned":
      return prefs.notifyAssignedTickets;
    case "transfer":
      return prefs.notifyTicketTransfers;
    default:
      return true;
  }
}

export async function loadEffectivePreferencesMap(
  companyId: number,
  userIds: number[]
): Promise<Map<number, EffectivePushPreferences>> {
  const uniq = [...new Set(userIds.filter(id => id != null && !Number.isNaN(Number(id))))];
  const map = new Map<number, EffectivePushPreferences>();
  uniq.forEach(id => {
    map.set(id, { ...DEFAULT_PUSH_PREFERENCES });
  });
  if (!uniq.length) {
    return map;
  }
  const rows = await UserNotificationPreferences.findAll({
    where: {
      companyId,
      userId: { [Op.in]: uniq }
    }
  });
  for (const row of rows) {
    map.set(row.userId, {
      pushEnabled: row.pushEnabled,
      notifyNewTickets: row.notifyNewTickets,
      notifyAssignedTickets: row.notifyAssignedTickets,
      notifyTicketMessages: row.notifyTicketMessages,
      notifyTicketTransfers: row.notifyTicketTransfers
    });
  }
  return map;
}

export function filterUserIdsByPushPreference(
  userIds: number[],
  category: PushPreferenceCategory,
  prefMap: Map<number, EffectivePushPreferences>
): { kept: number[]; skippedByPreferences: number[] } {
  const kept: number[] = [];
  const skippedByPreferences: number[] = [];
  for (const uid of userIds) {
    const prefs = prefMap.get(uid) ?? DEFAULT_PUSH_PREFERENCES;
    if (categoryAllowed(prefs, category)) {
      kept.push(uid);
    } else {
      skippedByPreferences.push(uid);
    }
  }
  return { kept, skippedByPreferences };
}
