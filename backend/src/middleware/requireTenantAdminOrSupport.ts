import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";

/** Admin da empresa ou super em modo suporte (tenant actual em `req.user.companyId`). */
export default function requireTenantAdminOrSupport(
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
