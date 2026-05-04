import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";

/**
 * Apenas admin da empresa ou utilizador em modo suporte podem alterar pipelines/etapas.
 */
export default function requireCrmPipelineAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const profile = req.user?.profile;
  const support = req.user?.supportMode === true;
  if (profile === "admin" || support) {
    next();
    return;
  }
  next(new AppError("ERR_NO_PERMISSION", 403));
}
