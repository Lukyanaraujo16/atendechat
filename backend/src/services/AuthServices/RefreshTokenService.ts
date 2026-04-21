import { verify } from "jsonwebtoken";
import { Response as Res } from "express";

import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { serializeUserForSession } from "../../helpers/SerializeUser";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  companyId: number | null;
  supportTargetCompanyId?: number;
}

interface Response {
  newToken: string;
  refreshToken: string;
  serializedUser: Awaited<ReturnType<typeof serializeUserForSession>>;
}

export const RefreshTokenService = async (
  res: Res,
  token: string
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion, companyId: homeInToken, supportTargetCompanyId } =
      decoded as RefreshTokenPayload;

    const user = await ShowUserService(id);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const normalizeHome = (v: unknown): number | null => {
      if (v === undefined || v === null || v === "") {
        return null;
      }
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };
    const tokenHome = normalizeHome(homeInToken);
    const userHome = user.companyId ?? null;
    if (tokenHome !== userHome) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const effectiveCompanyId =
      supportTargetCompanyId !== undefined && supportTargetCompanyId !== null
        ? supportTargetCompanyId
        : user.companyId ?? null;

    const newToken =
      supportTargetCompanyId !== undefined && supportTargetCompanyId !== null
        ? createAccessToken(user, { supportTargetCompanyId })
        : createAccessToken(user);

    const newRefresh = createRefreshToken(user, {
      supportTargetCompanyId:
        supportTargetCompanyId !== undefined && supportTargetCompanyId !== null
          ? supportTargetCompanyId
          : null
    });

    const serializedUser = await serializeUserForSession(user, effectiveCompanyId);

    return { newToken, refreshToken: newRefresh, serializedUser };
  } catch {
    res.clearCookie("jrt");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
