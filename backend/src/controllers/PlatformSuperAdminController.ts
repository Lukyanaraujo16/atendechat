import { Request, Response } from "express";

import ListSuperAdminsService from "../services/UserServices/ListSuperAdminsService";
import SearchUsersPlatformService from "../services/UserServices/SearchUsersPlatformService";
import UpdatePlatformSuperUserService from "../services/UserServices/UpdatePlatformSuperUserService";
import UpdatePlatformProfileService from "../services/UserServices/UpdatePlatformProfileService";
import CreatePlatformSuperUserService from "../services/UserServices/CreatePlatformSuperUserService";

export const listSuperAdmins = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const users = await ListSuperAdminsService();
  const rows = users.map((u) =>
    typeof (u as any).toJSON === "function" ? (u as any).toJSON() : u
  );
  return res.status(200).json(rows);
};

export const searchUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const q = String(req.query.q || req.query.query || "").trim();
  const users = await SearchUsersPlatformService({ query: q });
  const rows = users.map((u) =>
    typeof (u as any).toJSON === "function" ? (u as any).toJSON() : u
  );
  return res.status(200).json(rows);
};

export const createSuperUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await CreatePlatformSuperUserService(req.body);
  return res.status(201).json(user);
};

export const updateSuperUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }

  const user = await UpdatePlatformSuperUserService({
    targetUserId: userId,
    userData: req.body
  });

  return res.status(200).json(user);
};

export const updateMyProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const id = Number(req.user.id);
  const user = await UpdatePlatformProfileService(id, req.body);
  return res.status(200).json(user);
};
