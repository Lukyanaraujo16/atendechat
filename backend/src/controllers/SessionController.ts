import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
import Queue from "../models/Queue";
import { SerializeUser, serializeUserForSession } from "../helpers/SerializeUser";
import { createAccessToken, createRefreshToken } from "../helpers/CreateTokens";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import Company from "../models/Company";
import SupportAccessLog from "../models/SupportAccessLog";
import { Op } from "sequelize";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  SendRefreshToken(res, refreshToken);

  const io = getIO();
  if (serializedUser.companyId != null) {
    io.to(`user-${serializedUser.id}`).emit(
      `company-${serializedUser.companyId}-auth`,
      {
        action: "update",
        user: {
          id: serializedUser.id,
          email: serializedUser.email,
          companyId: serializedUser.companyId
        }
      }
    );
  }

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { newToken, refreshToken, serializedUser } = await RefreshTokenService(
    res,
    token
  );

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user: serializedUser });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  const { id, profile, super: superAdmin } = user;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return res.json({ id, profile, super: superAdmin });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.user;
  const user = await User.findByPk(id);
  await user.update({ online: false });

  res.clearCookie("jrt");

  return res.send();
};

export const supportStart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const raw = (req.body as { companyId?: number | string })?.companyId;
  const targetCompanyId =
    typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!targetCompanyId || Number.isNaN(targetCompanyId)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  const user = await User.findByPk(req.user.id, {
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Company, as: "company", attributes: ["id", "name", "dueDate"] }
    ]
  });

  if (!user?.super) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const company = await Company.findByPk(targetCompanyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  await SupportAccessLog.update(
    { endedAt: new Date() },
    { where: { userId: user.id, endedAt: { [Op.is]: null } } }
  );

  await SupportAccessLog.create({
    userId: user.id,
    companyId: targetCompanyId,
    startedAt: new Date()
  });

  const accessToken = createAccessToken(user, {
    supportTargetCompanyId: targetCompanyId
  });
  const refreshToken = createRefreshToken(user, {
    supportTargetCompanyId: targetCompanyId
  });

  SendRefreshToken(res, refreshToken);

  const serializedUser = await serializeUserForSession(user, targetCompanyId);

  return res.status(200).json({
    token: accessToken,
    user: serializedUser
  });
};

export const supportStop = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.user.supportMode) {
    throw new AppError("ERR_NOT_IN_SUPPORT", 400);
  }

  const user = await User.findByPk(req.user.id, {
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Company, as: "company", attributes: ["id", "name", "dueDate"] }
    ]
  });

  if (!user?.super) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const rt: string | undefined = req.cookies.jrt;
  if (!rt) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  let decoded: { supportTargetCompanyId?: number };
  try {
    decoded = verify(rt, authConfig.refreshSecret) as {
      supportTargetCompanyId?: number;
    };
  } catch {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  if (
    decoded.supportTargetCompanyId === undefined ||
    decoded.supportTargetCompanyId === null
  ) {
    throw new AppError("ERR_NOT_IN_SUPPORT", 400);
  }

  const openLog = await SupportAccessLog.findOne({
    where: { userId: user.id, endedAt: { [Op.is]: null } },
    order: [["startedAt", "DESC"]]
  });
  if (openLog) {
    await openLog.update({ endedAt: new Date() });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  SendRefreshToken(res, refreshToken);

  const serializedUser = await SerializeUser(user);

  return res.json({ token: accessToken, user: serializedUser });
};
