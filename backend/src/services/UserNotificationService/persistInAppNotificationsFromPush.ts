import CreateUserNotificationService from "./CreateUserNotificationService";
import { pushEventTypeToInAppCategory } from "../OneSignalPush/inAppPreferences";

export type PersistInAppFromPushInput = {
  userIds: number[];
  companyId: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Uma entrada por destinatário final (já filtrado por vista ativa e preferências).
 * Falhas por utilizador não bloqueiam os outros nem o fluxo de push.
 */
const persistInAppNotificationsFromPush = async (
  input: PersistInAppFromPushInput
): Promise<void> => {
  const { userIds, companyId, type, title, body, data } = input;
  const preferenceCategory = pushEventTypeToInAppCategory(type);
  const uniq = [...new Set(userIds.filter(id => id != null && !Number.isNaN(Number(id))))];
  for (const userId of uniq) {
    await CreateUserNotificationService({
      userId,
      companyId,
      type,
      title,
      body,
      data: { ...data },
      preferenceCategory
    });
  }
};

export default persistInAppNotificationsFromPush;
