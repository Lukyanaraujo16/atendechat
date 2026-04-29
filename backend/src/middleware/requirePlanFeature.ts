import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import { loadCompanyPlanContext } from "./loadCompanyEffectiveFeatures";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

/**
 * Exige pelo menos uma das chaves de feature ativa (plano + PlanFeatures + overrides).
 */
const requireAnyPlanFeature =
  (...featureKeys: string[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = await loadCompanyPlanContext(req);
      if (!ctx) {
        return next(new AppError("ERR_NO_PERMISSION", 403));
      }
      const ok = featureKeys.some((k) => ctx.featureMap[k] === true);
      if (!ok) {
        return next(
          new AppError(
            "ERR_PLAN_FEATURE_DISABLED",
            403,
            PLAN_FEATURE_DISABLED_MSG
          )
        );
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };

export default requireAnyPlanFeature;
