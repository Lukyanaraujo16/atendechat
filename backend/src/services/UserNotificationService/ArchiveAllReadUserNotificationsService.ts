import { Op } from "sequelize";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const ArchiveAllReadUserNotificationsService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const base = buildUserNotificationWhere(ctx, { archived: "default" });
  const where = {
    ...base,
    read: true,
    archivedAt: { [Op.is]: null }
  } as Record<string, unknown>;
  const [affected] = await UserNotification.update(
    { archivedAt: new Date() },
    { where }
  );
  logger.info(
    { userId: ctx.userId, archivedCount: affected, action: "archive_all_read" },
    "[UserNotification]"
  );
  return affected;
};

export default ArchiveAllReadUserNotificationsService;
