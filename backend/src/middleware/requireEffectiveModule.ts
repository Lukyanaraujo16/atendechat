import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import { EffectiveModuleFlags } from "../services/CompanyService/GetEffectiveModuleFlagsService";
import { loadCompanyPlanContext } from "./loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "./platformSuperBypass";
import { buildEffectiveModuleFlagsFromFeatureMap } from "../services/CompanyService/GetEffectiveModuleFlagsService";
import {
  computeEffectiveUserFeatureMapForRequest,
  USER_FEATURE_DISABLED_MSG
} from "../services/UserFeaturePermission/UserFeaturePermissionService";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

function isGranularFeatureKey(key: string): boolean {
  return key.includes(".");
}

/**
 * Exige que o módulo legado esteja liberado (derivado do mapa granular + overrides)
 * ou que a chave granular do plano (ex.: automation.ai_agent) esteja ativa,
 * e que o utilizador tenha permissão granular correspondente.
 */
const requireEffectiveModule = (key: keyof EffectiveModuleFlags | string) => {
  return async (
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

      if (isGranularFeatureKey(key)) {
        if (ctx.featureMap[key] !== true) {
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
        if (merged[key] !== true) {
          return next(
            new AppError(
              "ERR_USER_FEATURE_DISABLED",
              403,
              USER_FEATURE_DISABLED_MSG
            )
          );
        }
        return next();
      }

      if (!ctx.effectiveModules[key as keyof EffectiveModuleFlags]) {
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
      const modulesUser = buildEffectiveModuleFlagsFromFeatureMap(
        merged,
        ctx.company.modulePermissions
      );
      if (!modulesUser[key as keyof EffectiveModuleFlags]) {
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
};

export default requireEffectiveModule;
