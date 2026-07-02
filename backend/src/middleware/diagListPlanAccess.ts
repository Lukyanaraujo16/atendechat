import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Log temporário (diagnóstico P0): confirma que a requisição passou pelo isAuth
 * e chegou ao handler listPlan.
 */
export function diagListPlanAfterAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  logger.info(
    {
      tag: "[DiagListPlan]",
      event: "passed_isAuth",
      userId: req.user?.id ?? null,
      companyId: req.user?.companyId ?? null,
      profile: req.user?.profile ?? null,
      companyIdParam: req.params?.id ?? null
    },
    "[DiagListPlan] passed isAuth"
  );
  next();
}
