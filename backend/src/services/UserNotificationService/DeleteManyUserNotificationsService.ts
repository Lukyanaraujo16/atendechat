import { Op } from "sequelize";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const DeleteManyUserNotificationsService = async (
  ids: number[],
  ctx: NotificationRequestContext
): Promise<number> => {
  const uniq = [
    ...new Set(ids.map(id => Number(id)).filter(id => !Number.isNaN(id) && id > 0))
  ];
  if (!uniq.length) {
    return 0;
  }

  const base = buildUserNotificationWhere(ctx, { archived: "all" });
  const deleted = await UserNotification.destroy({
    where: {
      ...base,
      id: { [Op.in]: uniq }
    }
  });

  if (deleted > 0) {
    logger.info(
      { userId: ctx.userId, deleted, action: "delete_many", ids: uniq.length },
      "[UserNotification]"
    );
  }
  return deleted;
};

export default DeleteManyUserNotificationsService;
