import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const CountUnreadUserNotificationsService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const where = buildUserNotificationWhere(ctx, {
    archived: "default",
    readFilter: false
  });
  return UserNotification.count({ where });
};

export default CountUnreadUserNotificationsService;
