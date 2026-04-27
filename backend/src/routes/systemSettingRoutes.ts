import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as SystemSettingController from "../controllers/SystemSettingController";
import { brandingUpload } from "../config/brandingUpload";

const systemSettingRoutes = express.Router();

systemSettingRoutes.get(
  "/system-settings/branding",
  SystemSettingController.publicBranding
);

systemSettingRoutes.get(
  "/system-settings/branding-bootstrap.js",
  SystemSettingController.publicBrandingBootstrapScript
);

systemSettingRoutes.get(
  "/system-settings/public/push-config",
  SystemSettingController.publicPushConfig
);

systemSettingRoutes.get(
  "/system-settings/billing-automation",
  isAuth,
  isSuper,
  SystemSettingController.getBillingAutomation
);

systemSettingRoutes.put(
  "/system-settings/billing-automation",
  isAuth,
  isSuper,
  SystemSettingController.upsertBillingAutomation
);

systemSettingRoutes.get(
  "/system-settings",
  isAuth,
  isSuper,
  SystemSettingController.index
);

/** JSON (nome, limpar URLs legadas); POST evita 405 em proxies que só encaminham GET/POST ao SPA. */
systemSettingRoutes.post(
  "/system-settings",
  isAuth,
  isSuper,
  SystemSettingController.upsert
);

systemSettingRoutes.put(
  "/system-settings",
  isAuth,
  isSuper,
  SystemSettingController.upsert
);

systemSettingRoutes.post(
  "/system-settings/branding",
  isAuth,
  isSuper,
  brandingUpload.fields([
    { name: "loginLogo", maxCount: 1 },
    { name: "loginLogoDark", maxCount: 1 },
    { name: "menuLogo", maxCount: 1 },
    { name: "menuLogoDark", maxCount: 1 },
    { name: "favicon", maxCount: 1 }
  ]),
  SystemSettingController.updateBrandingMultipart
);

export default systemSettingRoutes;
