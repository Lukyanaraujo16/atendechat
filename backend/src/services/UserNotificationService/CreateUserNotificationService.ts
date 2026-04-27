import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import {
  InAppPreferenceCategory,
  isInAppNotificationAllowed
} from "../OneSignalPush/inAppPreferences";

export type CreateUserNotificationInput = {
  userId: number;
  companyId: number | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  /** Quando definido, aplica preferências in-app (central) por categoria. */
  preferenceCategory?: InAppPreferenceCategory | null;
};

export function emitUserNotificationSocket(
  userId: number,
  notification: Record<string, unknown>
): void {
  try {
    const io = getIO();
    io.to(`user-${userId}`).emit(`user-${userId}-notification`, {
      action: "create",
      notification
    });
  } catch (err) {
    logger.warn(
      { err, userId },
      "[UserNotification] socket_emit_failed"
    );
  }
}

/**
 * Cria registo na central e emite socket. Não propaga erros (fluxo principal não depende disto).
 */
const CreateUserNotificationService = async (
  input: CreateUserNotificationInput
): Promise<UserNotification | null> => {
  const {
    userId,
    companyId,
    type,
    title,
    body,
    data = null,
    preferenceCategory = null
  } = input;
  try {
    if (preferenceCategory != null) {
      const allowed = await isInAppNotificationAllowed(
        userId,
        companyId,
        preferenceCategory
      );
      if (!allowed) {
        logger.info(
          {
            userId,
            companyId,
            type,
            preferenceCategory,
            skipped: "in_app_preferences"
          },
          "[UserNotification]"
        );
        return null;
      }
    }
    const row = await UserNotification.create({
      userId,
      companyId,
      type,
      title,
      body,
      data,
      read: false,
      readAt: null,
      archivedAt: null
    });
    logger.info(
      {
        userId,
        companyId,
        type,
        id: row.id,
        action: "created"
      },
      "[UserNotification]"
    );
    const plain = row.get({ plain: true }) as Record<string, unknown>;
    emitUserNotificationSocket(userId, plain);
    return row;
  } catch (err) {
    logger.warn(
      {
        err,
        userId,
        companyId,
        type,
        created: false
      },
      "[UserNotification]"
    );
    return null;
  }
};

export default CreateUserNotificationService;
