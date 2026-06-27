import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import {
  InventorySalesGranularKey,
  planAllowsInventoryModule
} from "../config/inventorySalesPermissions";
import { loadCompanyPlanContext } from "./loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "./platformSuperBypass";
import {
  computeEffectiveUserFeatureMapForRequest,
  USER_FEATURE_DISABLED_MSG
} from "../services/UserFeaturePermission/UserFeaturePermissionService";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

/**
 * Exige plano com `inventory.sales` e permissão granular do utilizador.
 * Super admin da plataforma e admin da empresa mantêm bypass via mapa efectivo.
 */
const requireInventorySalesPermission =
  (...permissionKeys: InventorySalesGranularKey[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (await isPlatformSuperUser(req)) {
        return next();
      }
      const ctx = await loadCompanyPlanContext(req);
      if (!ctx || !planAllowsInventoryModule(ctx.featureMap)) {
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
      const userOk = permissionKeys.some((k) => merged[k] === true);
      if (!userOk) {
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

export default requireInventorySalesPermission;
