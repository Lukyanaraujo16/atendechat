import MarkUserNotificationReadService from "./MarkUserNotificationReadService";
import { NotificationRequestContext } from "./notificationRequestContext";

const MarkManyUserNotificationsReadService = async (
  ids: number[],
  ctx: NotificationRequestContext
): Promise<number> => {
  const uniq = [...new Set(ids.map(id => Number(id)).filter(id => !Number.isNaN(id)))];
  let n = 0;
  for (const id of uniq) {
    const row = await MarkUserNotificationReadService(id, ctx);
    if (row) {
      n += 1;
    }
  }
  return n;
};

export default MarkManyUserNotificationsReadService;
