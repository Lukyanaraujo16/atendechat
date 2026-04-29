import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as DashboardController from "../controllers/DashbardController";

const routes = express.Router();

routes.get(
  "/dashboard",
  isAuth,
  requireAnyPlanFeature("dashboard.main"),
  DashboardController.index
);
routes.get(
  "/dashboard/ticketsUsers",
  isAuth,
  requireAnyPlanFeature("dashboard.reports"),
  DashboardController.reportsUsers
);
routes.get(
  "/dashboard/ticketsDay",
  isAuth,
  requireAnyPlanFeature("dashboard.reports"),
  DashboardController.reportsDay
);

export default routes;
