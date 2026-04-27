import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import {
  NotificationRequestContext,
  userOwnsNotification
} from "./notificationRequestContext";

const ArchiveUserNotificationService = async (
  id: number,
  ctx: NotificationRequestContext
): Promise<UserNotification | null> => {
  const row = await UserNotification.findByPk(id);
  if (!row || !userOwnsNotification(row, ctx)) {
    return null;
  }
  const now = new Date();
  const updates: { read?: boolean; readAt?: Date; archivedAt: Date } = {
    archivedAt: now
  };
  if (!row.read) {
    updates.read = true;
    updates.readAt = now;
  }
  await row.update(updates);
  logger.info(
    {
      userId: ctx.userId,
      companyId: row.companyId,
      notificationId: row.id
    },
    "[UserNotification] archived"
  );
  return row;
};

export default ArchiveUserNotificationService;
