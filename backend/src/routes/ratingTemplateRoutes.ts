import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as RatingTemplateController from "../controllers/RatingTemplateController";

const routes = express.Router();

routes.get(
  "/rating-templates",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  RatingTemplateController.index
);
routes.post(
  "/rating-templates",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  RatingTemplateController.store
);
routes.put(
  "/rating-templates/:id",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  RatingTemplateController.update
);
routes.delete(
  "/rating-templates/:id",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  RatingTemplateController.remove
);

export default routes;
