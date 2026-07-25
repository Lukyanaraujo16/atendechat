import { Request, Response } from "express";
import User from "../models/User";
import { isInternalUser } from "../helpers/isInternalUser";
import { listEnabledPlatformPermissions } from "../services/PlatformUserPermissionService";
import AppError from "../errors/AppError";

/**
 * Probe isolado do Console Técnico (Fase 1.1).
 * Não consulta AgentOS / AutomationOrchestrator / dados de tenant.
 */
export const access = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.user?.id) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const row = await User.findByPk(req.user.id, {
    attributes: ["id", "super", "profile"]
  });

  if (!row) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const permissions = await listEnabledPlatformPermissions(row.id);

  return res.status(200).json({
    allowed: true,
    isInternalUser: isInternalUser(row),
    permissions
  });
};
