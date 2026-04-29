import { Router } from "express";

import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as UserController from "../controllers/UserController";
import * as NotificationPreferencesController from "../controllers/NotificationPreferencesController";

const userRoutes = Router();

userRoutes.get(
  "/users/me/notification-preferences",
  isAuth,
  NotificationPreferencesController.showMine
);
userRoutes.put(
  "/users/me/notification-preferences",
  isAuth,
  NotificationPreferencesController.updateMine
);

userRoutes.get("/users", isAuth, UserController.index);

userRoutes.get("/users/list", isAuth, UserController.list);

userRoutes.post(
  "/users",
  isAuth,
  requireAnyPlanFeature("team.users"),
  UserController.store
);

userRoutes.put(
  "/users/:userId",
  isAuth,
  requireAnyPlanFeature("team.users"),
  UserController.update
);

userRoutes.get("/users/:userId", isAuth, UserController.show);

userRoutes.delete(
  "/users/:userId",
  isAuth,
  requireAnyPlanFeature("team.users"),
  UserController.remove
);

userRoutes.post(
  "/users/set-language/:newLanguage",
  isAuth,
  UserController.setLanguage
);

export default userRoutes;
