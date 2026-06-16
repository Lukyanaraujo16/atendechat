import express from "express";

import * as MetaWebhookController from "../controllers/MetaWebhookController";

const metaWebhookRoutes = express.Router();

metaWebhookRoutes.get("/", MetaWebhookController.verify);

metaWebhookRoutes.post(
  "/",
  express.raw({ type: "application/json", limit: "5mb" }),
  MetaWebhookController.receive
);

export default metaWebhookRoutes;
