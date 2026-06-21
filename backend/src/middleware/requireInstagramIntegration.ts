import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import {
  INSTAGRAM_INTEGRATION_FEATURE_KEY,
  INSTAGRAM_NOT_AVAILABLE_IN_PLAN_MSG
} from "../config/instagramIntegrationFeature";
import { loadCompanyPlanContext } from "./loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "./platformSuperBypass";
import {
  computeEffectiveUserFeatureMapForRequest,
  USER_FEATURE_DISABLED_MSG
} from "../services/UserFeaturePermission/UserFeaturePermissionService";

const requireInstagramIntegration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (await isPlatformSuperUser(req)) {
      return next();
    }

    const ctx = await loadCompanyPlanContext(req);
    if (!ctx) {
      return next(new AppError("ERR_NO_PERMISSION", 403));
    }

    if (ctx.featureMap[INSTAGRAM_INTEGRATION_FEATURE_KEY] !== true) {
      return next(
        new AppError(
          "ERR_INSTAGRAM_NOT_AVAILABLE_IN_PLAN",
          403,
          INSTAGRAM_NOT_AVAILABLE_IN_PLAN_MSG
        )
      );
    }

    const merged = await computeEffectiveUserFeatureMapForRequest(
      req,
      ctx.featureMap
    );

    if (merged[INSTAGRAM_INTEGRATION_FEATURE_KEY] !== true) {
      return next(
        new AppError("ERR_USER_FEATURE_DISABLED", 403, USER_FEATURE_DISABLED_MSG)
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export default requireInstagramIntegration;
