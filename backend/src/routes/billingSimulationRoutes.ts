import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as BillingSimulationController from "../controllers/BillingSimulationController";

/**
 * Fase 8.4-F (C2) — simulação da automação de cobrança e status em lote.
 * Somente leitura; somente Super Admin. Registrar em routes/index.ts ANTES de qualquer
 * rota `GET /saas/companies/:companyId` de um segmento (o líder registra).
 */
const billingSimulationRoutes = express.Router();

billingSimulationRoutes.get(
  "/saas/billing-automation/simulation",
  isAuth,
  isSuper,
  BillingSimulationController.simulation
);

billingSimulationRoutes.get(
  "/saas/companies/billing-status",
  isAuth,
  isSuper,
  BillingSimulationController.billingStatus
);

export default billingSimulationRoutes;
