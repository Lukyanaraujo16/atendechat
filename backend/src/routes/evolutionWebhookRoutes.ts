import express from "express";
import * as EvolutionWebhookController from "../controllers/EvolutionWebhookController";

const evolutionWebhookRoutes = express.Router();

evolutionWebhookRoutes.post(
  "/:whatsappId",
  express.json({ limit: "1mb" }),
  EvolutionWebhookController.receive
);

export default evolutionWebhookRoutes;
