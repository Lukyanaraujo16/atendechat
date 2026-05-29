import { Op } from "sequelize";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

/** Apaga notificações lidas ainda na caixa ativa (não arquivadas). */
const DeleteAllReadUserNotificationsService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const base = buildUserNotificationWhere(ctx, { archived: "default", readFilter: true });
  const where = {
    ...base,
    read: true,
    archivedAt: { [Op.is]: null }
  } as Record<string, unknown>;

  const deleted = await UserNotification.destroy({ where });
  logger.info(
    { userId: ctx.userId, deleted, action: "delete_all_read" },
    "[UserNotification]"
  );
  return deleted;
};

export default DeleteAllReadUserNotificationsService;
