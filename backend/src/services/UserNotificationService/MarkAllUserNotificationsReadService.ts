import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import { buildUserNotificationWhere } from "./notificationWhere";

const MarkAllUserNotificationsReadService = async (
  ctx: NotificationRequestContext
): Promise<number> => {
  const where = buildUserNotificationWhere(ctx, {
    archived: "default",
    readFilter: false
  });
  const [affected] = await UserNotification.update(
    { read: true, readAt: new Date() },
    { where: { ...where, read: false } }
  );
  return affected;
};

export default MarkAllUserNotificationsReadService;
