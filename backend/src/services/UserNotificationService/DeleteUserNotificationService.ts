import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import {
  NotificationRequestContext,
  userOwnsNotification
} from "./notificationRequestContext";

const DeleteUserNotificationService = async (
  id: number,
  ctx: NotificationRequestContext
): Promise<boolean> => {
  const row = await UserNotification.findByPk(id);
  if (!row || !userOwnsNotification(row, ctx)) {
    return false;
  }
  await row.destroy();
  logger.info(
    {
      userId: ctx.userId,
      companyId: row.companyId,
      notificationId: row.id,
      action: "delete_one"
    },
    "[UserNotification]"
  );
  return true;
};

export default DeleteUserNotificationService;
