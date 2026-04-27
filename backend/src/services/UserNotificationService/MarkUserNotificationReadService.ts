import UserNotification from "../../models/UserNotification";
import {
  NotificationRequestContext,
  userOwnsNotification
} from "./notificationRequestContext";

const MarkUserNotificationReadService = async (
  id: number,
  ctx: NotificationRequestContext
): Promise<UserNotification | null> => {
  const row = await UserNotification.findByPk(id);
  if (!row || !userOwnsNotification(row, ctx)) {
    return null;
  }
  await row.update({
    read: true,
    readAt: new Date()
  });
  return row;
};

export default MarkUserNotificationReadService;
