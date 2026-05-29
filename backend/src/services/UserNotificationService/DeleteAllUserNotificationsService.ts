import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const DeleteAllUserNotificationsService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const where = buildUserNotificationWhere(ctx, { archived: "all" });
  const deleted = await UserNotification.destroy({ where });
  logger.info(
    { userId: ctx.userId, deleted, action: "delete_all" },
    "[UserNotification]"
  );
  return deleted;
};

export default DeleteAllUserNotificationsService;
