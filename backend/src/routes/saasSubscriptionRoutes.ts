import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as SaasSubscriptionController from "../controllers/SaasSubscriptionController";

/** Fase 8.4-F — central de assinatura, linha do tempo e prévia de baixa manual (Super Admin). */
const saasSubscriptionRoutes = express.Router();

saasSubscriptionRoutes.get(
  "/saas/companies/:companyId/subscription",
  isAuth,
  isSuper,
  SaasSubscriptionController.subscription
);
saasSubscriptionRoutes.get(
  "/saas/companies/:companyId/timeline",
  isAuth,
  isSuper,
  SaasSubscriptionController.timeline
);
saasSubscriptionRoutes.post(
  "/saas/companies/:companyId/finance/manual-payment/preview",
  isAuth,
  isSuper,
  SaasSubscriptionController.manualPaymentPreview
);

export default saasSubscriptionRoutes;
