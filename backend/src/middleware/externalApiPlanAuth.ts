import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import {
  loadPersistedPlanFeatureMap,
  resolvePlanFeature
} from "../services/PlanService/GetEffectivePlanFeaturesService";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

/**
 * Exige plano + overrides com API externa liberada (após tokenAuth).
 */
const externalApiPlanAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const whatsapp = req.apiWhatsapp;
    if (!whatsapp) {
      return next(new AppError("ERR_INVALID_API_TOKEN", 401));
    }

    const company = whatsapp.company as {
      id?: number;
      plan?: { id: number };
      modulePermissions?: Record<string, boolean> | null;
    };
    const plan = company?.plan;
    if (!plan?.id) {
      return next(new AppError("ERR_INVALID_API_TOKEN", 401));
    }

    const persisted = await loadPersistedPlanFeatureMap(plan.id);
    const allowed = resolvePlanFeature(
      plan as any,
      persisted,
      company.modulePermissions,
      "settings.api"
    );
    if (!allowed) {
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

export default externalApiPlanAuth;
