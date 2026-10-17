import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as SaasCompanyUsersController from "../controllers/SaasCompanyUsersController";

/** Fase 8.4 — usuários da empresa geridos pelo Super Admin. Todas exigem isAuth + isSuper. */
const saasCompanyUsersRoutes = express.Router();

saasCompanyUsersRoutes.get(
  "/saas/companies/:companyId/users",
  isAuth,
  isSuper,
  SaasCompanyUsersController.index
);

saasCompanyUsersRoutes.post(
  "/saas/companies/:companyId/users",
  isAuth,
  isSuper,
  SaasCompanyUsersController.store
);

saasCompanyUsersRoutes.put(
  "/saas/companies/:companyId/users/:userId",
  isAuth,
  isSuper,
  SaasCompanyUsersController.update
);

saasCompanyUsersRoutes.patch(
  "/saas/companies/:companyId/users/:userId/active",
  isAuth,
  isSuper,
  SaasCompanyUsersController.setActive
);

saasCompanyUsersRoutes.post(
  "/saas/companies/:companyId/users/:userId/password",
  isAuth,
  isSuper,
  SaasCompanyUsersController.resetPassword
);

export default saasCompanyUsersRoutes;
