import { Op } from "sequelize";
import { subDays } from "date-fns";
import { logger } from "../../utils/logger";
import UserNotification from "../../models/UserNotification";

/**
 * - Lidas + arquivadas há mais de 90 dias: apagar.
 * - Lidas + não arquivadas com mais de 180 dias: apagar.
 * - Não lidas: nunca apagar.
 */
const CleanupOldUserNotificationsService = async (): Promise<{
  deletedArchivedOld: number;
  deletedReadStale: number;
}> => {
  const cutoffArchived = subDays(new Date(), 90);
  const cutoffReadOnly = subDays(new Date(), 180);

  const deletedArchivedOld = await UserNotification.destroy({
    where: {
      read: true,
      [Op.and]: [
        { archivedAt: { [Op.ne]: null } },
        { archivedAt: { [Op.lt]: cutoffArchived } }
      ]
    }
  });

  const deletedReadStale = await UserNotification.destroy({
    where: {
      read: true,
      archivedAt: { [Op.is]: null },
      createdAt: { [Op.lt]: cutoffReadOnly }
    }
  });

  logger.info(
    {
      deletedCount: deletedArchivedOld + deletedReadStale,
      deletedArchivedOld,
      deletedReadStale
    },
    "[UserNotificationCleanup]"
  );

  return { deletedArchivedOld, deletedReadStale };
};

export default CleanupOldUserNotificationsService;
