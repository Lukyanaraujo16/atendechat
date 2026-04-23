import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as PlatformSuperAdminController from "../controllers/PlatformSuperAdminController";
import * as PlatformCompanySignupRequestController from "../controllers/PlatformCompanySignupRequestController";

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

platformSuperRoutes.post(
  "/platform/super-admins",
  isAuth,
  isSuper,
  PlatformSuperAdminController.createSuperUser
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

platformSuperRoutes.get(
  "/platform/signup-requests/summary",
  isAuth,
  isSuper,
  PlatformCompanySignupRequestController.summaryCounts
);

platformSuperRoutes.get(
  "/platform/signup-requests",
  isAuth,
  isSuper,
  PlatformCompanySignupRequestController.index
);

platformSuperRoutes.post(
  "/platform/signup-requests/:id/approve",
  isAuth,
  isSuper,
  PlatformCompanySignupRequestController.approve
);

platformSuperRoutes.post(
  "/platform/signup-requests/:id/reject",
  isAuth,
  isSuper,
  PlatformCompanySignupRequestController.reject
);

platformSuperRoutes.post(
  "/platform/signup-requests/:id/resend-invite",
  isAuth,
  isSuper,
  PlatformCompanySignupRequestController.resendInvite
);

export default platformSuperRoutes;
