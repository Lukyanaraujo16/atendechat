import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as PlatformSuperAdminController from "../controllers/PlatformSuperAdminController";

const platformSuperRoutes = Router();

platformSuperRoutes.get(
  "/platform/super-admins",
  isAuth,
  isSuper,
  PlatformSuperAdminController.listSuperAdmins
);

platformSuperRoutes.get(
  "/platform/super-admins/search",
  isAuth,
  isSuper,
  PlatformSuperAdminController.searchUsers
);

platformSuperRoutes.put(
  "/platform/super-admins/:userId",
  isAuth,
  isSuper,
  PlatformSuperAdminController.updateSuperUser
);

platformSuperRoutes.put(
  "/platform/me",
  isAuth,
  isSuper,
  PlatformSuperAdminController.updateMyProfile
);

export default platformSuperRoutes;
