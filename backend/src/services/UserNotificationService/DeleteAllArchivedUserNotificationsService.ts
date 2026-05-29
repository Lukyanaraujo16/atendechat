import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const DeleteAllArchivedUserNotificationsService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const where = buildUserNotificationWhere(ctx, { archived: "only" });
  const deleted = await UserNotification.destroy({ where });
  logger.info(
    { userId: ctx.userId, deleted, action: "delete_all_archived" },
    "[UserNotification]"
  );
  return deleted;
};

export default DeleteAllArchivedUserNotificationsService;
