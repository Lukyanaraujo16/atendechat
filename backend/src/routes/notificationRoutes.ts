import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as UserNotificationController from "../controllers/UserNotificationController";

const notificationRoutes = Router();

notificationRoutes.get(
  "/notifications/unread-count",
  isAuth,
  UserNotificationController.unreadCount
);
notificationRoutes.put(
  "/notifications/read-all",
  isAuth,
  UserNotificationController.markAllRead
);
notificationRoutes.put(
  "/notifications/read-bulk",
  isAuth,
  UserNotificationController.markManyRead
);
notificationRoutes.get(
  "/notifications",
  isAuth,
  UserNotificationController.index
);
notificationRoutes.put(
  "/notifications/archive-all",
  isAuth,
  UserNotificationController.archiveAllRead
);
notificationRoutes.put(
  "/notifications/archive-bulk",
  isAuth,
  UserNotificationController.archiveMany
);
notificationRoutes.put(
  "/notifications/:id/read",
  isAuth,
  UserNotificationController.markRead
);
notificationRoutes.put(
  "/notifications/:id/archive",
  isAuth,
  UserNotificationController.archiveOne
);

export default notificationRoutes;
