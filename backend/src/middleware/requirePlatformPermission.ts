import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import { isInternalUser } from "../helpers/isInternalUser";
import { hasPlatformPermission } from "../services/PlatformUserPermissionService";
import {
  AGENTOS_CONSOLE_VIEW_PERMISSION,
  PLATFORM_PERMISSION_KEYS
} from "../config/platformPermissionConstants";

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

/**
 * Ação AgentOS: identidade interna + console.view + permissão específica.
 * Preferir este helper a empilhar requireAgentOsConsole + requirePlatformPermission.
 */
export function requireAgentOsConsoleAction(extraPermissionKey: string) {
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

      const hasView = await hasPlatformPermission(
        row.id,
        AGENTOS_CONSOLE_VIEW_PERMISSION
      );
      if (!hasView) {
        next(
          new AppError(
            "ERR_PLATFORM_PERMISSION_DENIED",
            403,
            "Permissão de plataforma insuficiente."
          )
        );
        return;
      }

      if (extraPermissionKey !== AGENTOS_CONSOLE_VIEW_PERMISSION) {
        const hasExtra = await hasPlatformPermission(row.id, extraPermissionKey);
        if (!hasExtra) {
          next(
            new AppError(
              "ERR_PLATFORM_PERMISSION_DENIED",
              403,
              "Permissão de plataforma insuficiente."
            )
          );
          return;
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Após requireAgentOsConsole no stack: exige apenas a chave adicional.
 * Evita revalidar identidade/view quando já passaram no stack.
 */
export function requireAdditionalPlatformPermission(permissionKey: string) {
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
      const allowed = await hasPlatformPermission(
        Number(req.user.id),
        permissionKey
      );
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

/** Atalhos de mutação / leitura sensível (Fase 1.4). */
export const requireAgentOsManage = requireAdditionalPlatformPermission(
  PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_MANAGE
);
export const requireAgentOsReplayExecute = requireAdditionalPlatformPermission(
  PLATFORM_PERMISSION_KEYS.AGENTOS_REPLAY_EXECUTE
);
export const requireAgentOsRolloutManage = requireAdditionalPlatformPermission(
  PLATFORM_PERMISSION_KEYS.AGENTOS_ROLLOUT_MANAGE
);
export const requireAgentOsProductionManage =
  requireAdditionalPlatformPermission(
    PLATFORM_PERMISSION_KEYS.AGENTOS_PRODUCTION_MANAGE
  );
export const requireAgentOsIncidentsManage =
  requireAdditionalPlatformPermission(
    PLATFORM_PERMISSION_KEYS.AGENTOS_INCIDENTS_MANAGE
  );
export const requireAgentOsSecurityView = requireAdditionalPlatformPermission(
  PLATFORM_PERMISSION_KEYS.AGENTOS_SECURITY_VIEW
);

export default requirePlatformPermission;
