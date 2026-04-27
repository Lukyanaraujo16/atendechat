import { Op } from "sequelize";
import UserNotificationPreferences from "../../models/UserNotificationPreferences";

export type InAppPreferenceCategory =
  | "new_ticket"
  | "message"
  | "assigned"
  | "transfer"
  | "appointment"
  | "billing";

export type EffectiveInAppPreferences = {
  inAppEnabled: boolean;
  inAppNewTickets: boolean;
  inAppAssignedTickets: boolean;
  inAppTicketMessages: boolean;
  inAppTicketTransfers: boolean;
  inAppAgenda: boolean;
  inAppBilling: boolean;
};

export const DEFAULT_IN_APP_PREFERENCES: EffectiveInAppPreferences = {
  inAppEnabled: true,
  inAppNewTickets: true,
  inAppAssignedTickets: true,
  inAppTicketMessages: true,
  inAppTicketTransfers: true,
  inAppAgenda: true,
  inAppBilling: true
};

function categoryAllowedInApp(
  prefs: EffectiveInAppPreferences,
  category: InAppPreferenceCategory
): boolean {
  if (!prefs.inAppEnabled) {
    return false;
  }
  switch (category) {
    case "new_ticket":
      return prefs.inAppNewTickets;
    case "message":
      return prefs.inAppTicketMessages;
    case "assigned":
      return prefs.inAppAssignedTickets;
    case "transfer":
      return prefs.inAppTicketTransfers;
    case "appointment":
      return prefs.inAppAgenda;
    case "billing":
      return prefs.inAppBilling;
    default:
      return true;
  }
}

/**
 * `preferenceLookupCompanyId` alinhado ao contexto da notificação:
 * — número: preferências da empresa (tickets, agenda tenant, etc.);
 * — null: preferências de plataforma (userId + companyId NULL na tabela), p.ex. cobrança para super.
 */
export async function loadEffectiveInAppPreferences(
  userId: number,
  preferenceLookupCompanyId: number | null
): Promise<EffectiveInAppPreferences> {
  const where =
    preferenceLookupCompanyId != null && preferenceLookupCompanyId > 0
      ? { userId, companyId: preferenceLookupCompanyId }
      : { userId, companyId: { [Op.is]: null } };

  const row = await UserNotificationPreferences.findOne({ where });
  if (!row) {
    return { ...DEFAULT_IN_APP_PREFERENCES };
  }
  return {
    inAppEnabled: row.inAppEnabled,
    inAppNewTickets: row.inAppNewTickets,
    inAppAssignedTickets: row.inAppAssignedTickets,
    inAppTicketMessages: row.inAppTicketMessages,
    inAppTicketTransfers: row.inAppTicketTransfers,
    inAppAgenda: row.inAppAgenda,
    inAppBilling: row.inAppBilling
  };
}

export async function isInAppNotificationAllowed(
  userId: number,
  preferenceLookupCompanyId: number | null,
  category: InAppPreferenceCategory
): Promise<boolean> {
  const prefs = await loadEffectiveInAppPreferences(
    userId,
    preferenceLookupCompanyId
  );
  return categoryAllowedInApp(prefs, category);
}

export function pushEventTypeToInAppCategory(
  eventType: string
): InAppPreferenceCategory {
  if (eventType === "ticket_message_inbound") return "message";
  if (eventType === "ticket_assigned") return "assigned";
  if (eventType === "ticket_queue_transfer") return "transfer";
  return "new_ticket";
}
