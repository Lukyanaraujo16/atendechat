import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as SubscriptionController from "../controllers/SubscriptionController";

const subscriptionRoutes = express.Router();
subscriptionRoutes.post(
  "/subscription",
  isAuth,
  requireAnyPlanFeature("finance.subscription"),
  SubscriptionController.createSubscription
);
/** Configuração de webhook Efí — apenas Super Admin (Marco 1). */
subscriptionRoutes.post(
  "/subscription/create/webhook",
  isAuth,
  isSuper,
  SubscriptionController.createWebhook
);
subscriptionRoutes.post("/subscription/webhook", SubscriptionController.webhook);

export default subscriptionRoutes;
