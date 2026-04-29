import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";
import multer from "multer";
import uploadConfig from "../config/uploadExt";

import * as FlowCampaignController from "../controllers/FlowCampaignController";


const flowCampaignRoutes = express.Router();

flowCampaignRoutes.post(
  "/flowcampaign",
  isAuth,
  requireAnyPlanFeature("automation.keywords"),
  requireCompanyNotDelinquent,
  FlowCampaignController.createFlowCampaign
);

flowCampaignRoutes.get("/flowcampaign", isAuth,
  requireAnyPlanFeature("automation.keywords"), FlowCampaignController.flowCampaigns);

flowCampaignRoutes.get("/flowcampaign/:idFlow", isAuth,
  requireAnyPlanFeature("automation.keywords"), FlowCampaignController.flowCampaign);

flowCampaignRoutes.put(
  "/flowcampaign",
  isAuth,
  requireAnyPlanFeature("automation.keywords"),
  requireCompanyNotDelinquent,
  FlowCampaignController.updateFlowCampaign
);

flowCampaignRoutes.delete(
  "/flowcampaign/:idFlow",
  isAuth,
  requireAnyPlanFeature("automation.keywords"),
  FlowCampaignController.deleteFlowCampaign
);

export default flowCampaignRoutes;
