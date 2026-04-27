import UserNotification from "../../models/UserNotification";
import { NotificationRequestContext } from "./notificationRequestContext";
import {
  buildUserNotificationWhere,
  NotificationListFilters
} from "./notificationWhere";

type ListParams = {
  ctx: NotificationRequestContext;
  page: number;
  limit: number;
  filters: NotificationListFilters;
};

const ListUserNotificationsService = async ({
  ctx,
  page,
  limit,
  filters
}: ListParams): Promise<{
  notifications: UserNotification[];
  count: number;
  hasMore: boolean;
}> => {
  const where = buildUserNotificationWhere(ctx, filters);
  const offset = (page - 1) * limit;

  const { rows, count } = await UserNotification.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  return {
    notifications: rows,
    count,
    hasMore: offset + rows.length < count
  };
};

export default ListUserNotificationsService;
