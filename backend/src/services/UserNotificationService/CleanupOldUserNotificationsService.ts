import { Op } from "sequelize";
import { subDays, subHours } from "date-fns";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";
import {
  RETENTION_ARCHIVED_HOURS,
  RETENTION_READ_HOURS,
  RETENTION_UNREAD_DAYS
} from "../../config/userNotificationRetention";

/**
 * Limpeza global (todos os utilizadores). Ver userNotificationRetention.ts.
 */
const CleanupOldUserNotificationsService = async (): Promise<{
  deletedArchived: number;
  deletedRead: number;
  deletedUnreadStale: number;
}> => {
  const now = new Date();
  const cutoffArchived = subHours(now, RETENTION_ARCHIVED_HOURS);
  const cutoffRead = subHours(now, RETENTION_READ_HOURS);
  const cutoffUnread = subDays(now, RETENTION_UNREAD_DAYS);

  const deletedArchived = await UserNotification.destroy({
    where: {
      [Op.and]: [
        { archivedAt: { [Op.ne]: null } },
        { archivedAt: { [Op.lt]: cutoffArchived } }
      ]
    }
  });

  const deletedRead = await UserNotification.destroy({
    where: {
      read: true,
      archivedAt: { [Op.is]: null },
      [Op.or]: [
        { readAt: { [Op.lt]: cutoffRead } },
        {
          readAt: { [Op.is]: null },
          updatedAt: { [Op.lt]: cutoffRead }
        }
      ]
    }
  });

  const deletedUnreadStale = await UserNotification.destroy({
    where: {
      read: false,
      createdAt: { [Op.lt]: cutoffUnread }
    }
  });

  const removedCount = deletedArchived + deletedRead + deletedUnreadStale;

  logger.info(
    {
      removedCount,
      deletedArchived,
      deletedRead,
      deletedUnreadStale,
      retentionReadHours: RETENTION_READ_HOURS,
      retentionArchivedHours: RETENTION_ARCHIVED_HOURS,
      retentionUnreadDays: RETENTION_UNREAD_DAYS
    },
    "[UserNotificationsCleanup]"
  );

  return { deletedArchived, deletedRead, deletedUnreadStale };
};

export default CleanupOldUserNotificationsService;
