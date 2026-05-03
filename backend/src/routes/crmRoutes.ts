import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as CrmController from "../controllers/CrmController";

const crmRoutes = express.Router();

crmRoutes.get(
  "/crm/pipelines",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.listPipelines
);
crmRoutes.post(
  "/crm/pipelines",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.createPipeline
);
crmRoutes.put(
  "/crm/pipelines/:id",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.updatePipeline
);

crmRoutes.get(
  "/crm/deals",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.listDeals
);
crmRoutes.post(
  "/crm/deals",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.storeDeal
);
crmRoutes.get(
  "/crm/deals/:id",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.showDeal
);
crmRoutes.put(
  "/crm/deals/:id",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.updateDeal
);
crmRoutes.put(
  "/crm/deals/:id/stage",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.moveDealStage
);
crmRoutes.delete(
  "/crm/deals/:id",
  isAuth,
  requireAnyPlanFeature("crm.pipeline"),
  CrmController.removeDeal
);

export default crmRoutes;
