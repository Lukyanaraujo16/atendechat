import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as SubscriptionController from "../controllers/SubscriptionController";

const subscriptionRoutes = express.Router();
subscriptionRoutes.post(
  "/subscription",
  isAuth,
  requireAnyPlanFeature("finance.subscription"),
  SubscriptionController.createSubscription
);
subscriptionRoutes.post("/subscription/create/webhook", SubscriptionController.createWebhook);
subscriptionRoutes.post("/subscription/webhook", SubscriptionController.webhook);

export default subscriptionRoutes;
