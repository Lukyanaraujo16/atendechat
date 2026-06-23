import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import { loadCompanyPlanContext } from "./loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "./platformSuperBypass";
import {
  computeEffectiveUserFeatureMapForRequest,
  logTicketsAccessDebug,
  USER_FEATURE_DISABLED_MSG
} from "../services/UserFeaturePermission/UserFeaturePermissionService";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

/**
 * Exige pelo menos uma das chaves de feature ativa (plano + PlanFeatures + overrides)
 * e permissão individual (super / admin empresa / modo suporte ignoram a camada individual).
 */
const requireAnyPlanFeature =
  (...featureKeys: string[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (await isPlatformSuperUser(req)) {
        return next();
      }
      const ctx = await loadCompanyPlanContext(req);
      if (!ctx) {
        return next(new AppError("ERR_NO_PERMISSION", 403));
      }
      const planOk = featureKeys.some((k) => ctx.featureMap[k] === true);
      if (!planOk) {
        return next(
          new AppError(
            "ERR_PLAN_FEATURE_DISABLED",
            403,
            PLAN_FEATURE_DISABLED_MSG
          )
        );
      }
      const merged = await computeEffectiveUserFeatureMapForRequest(
        req,
        ctx.featureMap
      );
      const userOk = featureKeys.some((k) => merged[k] === true);
      if (!userOk) {
        const attendanceKeys = ["attendance.inbox", "attendance.kanban"];
        if (featureKeys.some((k) => attendanceKeys.includes(k))) {
          const planFeatureKey =
            featureKeys.find((k) => ctx.featureMap[k] === true) ||
            featureKeys[0];
          logTicketsAccessDebug({
            userId: Number(req.user.id),
            companyId: Number(req.user.companyId),
            profile: String(req.user.profile),
            requestedFeature: featureKeys,
            planFeatureKey,
            planAllows: planOk,
            userAllows: userOk,
            finalAllows: false,
            source: "requireAnyPlanFeature"
          });
        }
        return next(
          new AppError(
            "ERR_USER_FEATURE_DISABLED",
            403,
            USER_FEATURE_DISABLED_MSG
          )
        );
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };

export default requireAnyPlanFeature;
