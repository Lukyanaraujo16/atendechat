import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import { isInternalUser } from "../helpers/isInternalUser";
import { hasPlatformPermission } from "../services/PlatformUserPermissionService";
import { AGENTOS_CONSOLE_VIEW_PERMISSION } from "../config/platformPermissionConstants";

/**
 * Exige identidade interna + permissão de plataforma habilitada.
 * Fonte de verdade: tabela PlatformUserPermissions (não JWT, não plano).
 * supportMode / admin tenant / features comerciais NÃO substituem este gate.
 */
export function requirePlatformPermission(permissionKey: string) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        next(new AppError("ERR_SESSION_EXPIRED", 401));
        return;
      }

      const row = await User.findByPk(req.user.id, {
        attributes: ["id", "super", "profile"]
      });

      if (!row || !isInternalUser(row)) {
        next(
          new AppError(
            "ERR_PLATFORM_INTERNAL_ACCESS_REQUIRED",
            403,
            "Acesso restrito à equipe interna da plataforma."
          )
        );
        return;
      }

      const allowed = await hasPlatformPermission(row.id, permissionKey);
      if (!allowed) {
        next(
          new AppError(
            "ERR_PLATFORM_PERMISSION_DENIED",
            403,
            "Permissão de plataforma insuficiente."
          )
        );
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Gate mínimo do Console Técnico / AgentOS (Architecture Lock §19).
 */
export const requireAgentOsConsole = requirePlatformPermission(
  AGENTOS_CONSOLE_VIEW_PERMISSION
);

export default requirePlatformPermission;
