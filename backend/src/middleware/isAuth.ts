import { verify, decode } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import authConfig from "../config/auth";
import { logger } from "../utils/logger";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number | null;
  supportMode?: boolean;
  supportHomeCompanyId?: number | null;
  iat: number;
  exp: number;
}

function safeTokenPreview(token: string | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function safeDecodeClaims(token: string | undefined): {
  userId?: string;
  companyId?: number | null;
} {
  try {
    if (!token) return {};
    const decoded = decode(token);
    if (!decoded || typeof decoded !== "object") return {};
    const d = decoded as TokenPayload;
    return {
      userId: d.id != null ? String(d.id) : undefined,
      companyId: d.companyId ?? null
    };
  } catch {
    return {};
  }
}

function shouldDiagListPlan(req: Request): boolean {
  return String(req.originalUrl || req.url || "").includes("listPlan");
}

const isAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const hasAuthorizationHeader = Boolean(
    authHeader && typeof authHeader === "string" && authHeader.trim().length > 0
  );

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, profile, companyId, supportMode, supportHomeCompanyId } =
      decoded as TokenPayload;
    req.user = {
      id,
      profile,
      companyId,
      ...(supportMode !== undefined ? { supportMode } : {}),
      ...(supportHomeCompanyId !== undefined ? { supportHomeCompanyId } : {})
    };
  } catch (err) {
    if (shouldDiagListPlan(req)) {
      const partial = safeDecodeClaims(token);
      logger.warn(
        {
          tag: "[DiagListPlan]",
          event: "isAuth_rejected",
          url: req.originalUrl || req.url || "",
          method: req.method,
          hasAuthorizationHeader,
          tokenPreview: safeTokenPreview(token),
          errorName: err instanceof Error ? err.name : "UnknownError",
          errorMessage: err instanceof Error ? err.message : String(err),
          userId: partial.userId ?? null,
          companyId: partial.companyId ?? null
        },
        "[DiagListPlan] isAuth rejected"
      );
    }
    throw new AppError("Invalid token. We'll try to assign a new one on next request", 403);
  }

  return next();
};

export default isAuth;
