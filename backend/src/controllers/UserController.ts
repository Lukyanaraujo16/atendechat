import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import SimpleListService from "../services/UserServices/SimpleListService";
import ListUsersForTransferService from "../services/UserServices/ListUsersForTransferService";
import User from "../models/User";
import SetLanguageCompanyService from "../services/UserServices/SetLanguageCompanyService";
import { loadCompanyPlanContext } from "../middleware/loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "../middleware/platformSuperBypass";
import {
  assertActorCanManageUsers,
  assertSupervisorTargetRules,
  loadExplicitUserFeatureMap
} from "../services/UserFeaturePermission/UserFeaturePermissionService";
import { logger } from "../utils/logger";

async function resolveUserCompanyScope(
  req: Request
): Promise<{ skipCompanyScope: boolean; isPlatformSuper: boolean }> {
  const { supportMode, id } = req.user;
  const isSupportSelf =
    supportMode === true &&
    req.params.userId != null &&
    Number(req.params.userId) === Number(id);
  const isPlatformSuper = await isPlatformSuperUser(req);
  return {
    skipCompanyScope: isSupportSelf || isPlatformSuper,
    isPlatformSuper
  };
}

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const actor = await User.findByPk(req.user.id, {
    attributes: ["id", "profile", "super"]
  });
  if (!actor) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const ctx = await loadCompanyPlanContext(req);
  const featureMap =
    ctx?.featureMap ??
    ((await isPlatformSuperUser(req)) ? ({} as Record<string, boolean>) : null);
  if (featureMap === null) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  await assertActorCanManageUsers(actor, featureMap);

  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    email,
    password,
    name,
    profile,
    companyId: bodyCompanyId,
    queueIds,
    whatsappId,
    allTicket,
    featurePermissions
  } = req.body;
  let userCompanyId: number | null = null;

  let actorForCreate: Pick<User, "id" | "profile" | "super"> | null = null;

  if (req.user !== undefined) {
    const { companyId: cId } = req.user;
    userCompanyId = cId;
    actorForCreate = await User.findByPk(req.user.id, {
      attributes: ["id", "profile", "super"]
    });
  }

  const newUserCompanyId = bodyCompanyId || userCompanyId;

  if (req.url === "/signup") {
    if ((await CheckSettingsHelper("userCreation")) === "disabled") {
      throw new AppError("ERR_USER_CREATION_DISABLED", 403);
    }
  } else {
    if (!actorForCreate) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    const ctx = await loadCompanyPlanContext(req);
    const featureMap =
      ctx?.featureMap ??
      ((await isPlatformSuperUser(req)) ? ({} as Record<string, boolean>) : null);
    if (featureMap === null) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    await assertActorCanManageUsers(actorForCreate, featureMap);
    if (newUserCompanyId !== req.user?.companyId && !actorForCreate?.super) {
      throw new AppError("ERR_NO_SUPER", 403);
    }
    await assertSupervisorTargetRules({
      actor: { profile: actorForCreate.profile },
      targetProfile: profile ?? "admin"
    });
  }

  const user = await CreateUserService({
    email,
    password,
    name,
    profile,
    companyId: newUserCompanyId,
    queueIds,
    whatsappId,
    allTicket,
    featurePermissions,
    actor: actorForCreate
  });

  const io = getIO();
  io.to(`company-${userCompanyId}-mainchannel`).emit(`company-${userCompanyId}-user`, {
    action: "create",
    user
  });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, id } = req.user;

  const { skipCompanyScope } = await resolveUserCompanyScope(req);

  const user = await ShowUserService(
    userId,
    skipCompanyScope ? undefined : companyId
  );

  const plain = { ...user.get({ plain: true }) };

  if (
    Number(userId) !== Number(id) &&
    user.profile !== "admin" &&
    !skipCompanyScope
  ) {
    const actor = await User.findByPk(req.user.id, {
      attributes: ["id", "profile", "super"]
    });
    const ctx = await loadCompanyPlanContext(req);
    if (ctx) {
      try {
        await assertActorCanManageUsers(actor, ctx.featureMap);
        const explicit = await loadExplicitUserFeatureMap(user.id);
        const keys = Object.entries(ctx.featureMap)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        const state: Record<string, boolean> = {};
        for (const k of keys) {
          state[k] =
            explicit === null
              ? true
              : Object.prototype.hasOwnProperty.call(explicit, k)
                ? explicit[k] === true
                : true;
        }
        Object.assign(plain, {
          featurePermissionPlanKeys: keys,
          featurePermissions: state
        });
      } catch {
        /* omitir metadados de permissões */
      }
    }
  }

  return res.status(200).json(plain);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: requestUserId, companyId, supportMode } = req.user;
  const { userId } = req.params;
  const userData = req.body;

  const { skipCompanyScope, isPlatformSuper } = await resolveUserCompanyScope(req);

  const actor = await User.findByPk(requestUserId, {
    attributes: ["id", "profile", "super"]
  });

  const allow =
    actor?.profile === "admin" ||
    skipCompanyScope ||
    isPlatformSuper ||
    (actor?.profile === "supervisor" &&
      Number(userId) !== Number(requestUserId));

  if (!allow || !actor) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const targetBefore = await ShowUserService(
    userId,
    skipCompanyScope ? undefined : companyId
  );

  const effectiveCompanyId = targetBefore.companyId ?? companyId;

  logger.info(
    {
      requesterId: requestUserId,
      requesterProfile: actor.profile,
      requesterCompanyId: companyId,
      targetUserId: userId,
      targetCompanyId: targetBefore.companyId ?? null,
      isSelf: Number(userId) === Number(requestUserId),
      supportMode: supportMode === true,
      isPlatformSuper
    },
    "[UserUpdate] start"
  );

  if (
    actor.profile === "supervisor" &&
    Number(userId) === Number(requestUserId) &&
    userData.profile &&
    userData.profile !== "supervisor"
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (!skipCompanyScope && actor.profile === "supervisor") {
    const ctx = await loadCompanyPlanContext(req);
    if (!ctx) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    await assertActorCanManageUsers(actor, ctx.featureMap);
    await assertSupervisorTargetRules({
      actor: { profile: actor.profile },
      targetProfile: targetBefore.profile,
      nextProfile: userData.profile
    });
  }

  const user = await UpdateUserService({
    userData,
    userId,
    companyId: effectiveCompanyId,
    requestUserId: +requestUserId,
    skipCompanyScopeForShow: skipCompanyScope
  });

  const io = getIO();
  io.to(`company-${effectiveCompanyId}-mainchannel`).emit(
    `company-${effectiveCompanyId}-user`,
    {
      action: "update",
      user
    }
  );

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId } = req.user;

  const actor = await User.findByPk(req.user.id, {
    attributes: ["id", "profile", "super"]
  });
  const ctx = await loadCompanyPlanContext(req);
  const featureMap =
    ctx?.featureMap ??
    ((await isPlatformSuperUser(req)) ? ({} as Record<string, boolean>) : null);
  if (featureMap === null) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  await assertActorCanManageUsers(actor, featureMap);

  const isPlatformSuper = await isPlatformSuperUser(req);
  const targetUser = await ShowUserService(
    userId,
    isPlatformSuper ? undefined : companyId
  );
  const effectiveCompanyId = targetUser.companyId ?? companyId;

  await DeleteUserService(userId, effectiveCompanyId);

  const io = getIO();
  io.to(`company-${effectiveCompanyId}-mainchannel`).emit(
    `company-${effectiveCompanyId}-user`,
    {
      action: "delete",
      userId
    }
  );

  return res.status(200).json({ message: "User deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.query;
  const { companyId: userCompanyId, id: requestUserId, supportMode } = req.user;
  const targetCompanyId = companyId ? +companyId : userCompanyId;

  const isPlatformSuper = await isPlatformSuperUser(req);
  if (
    !isPlatformSuper &&
    targetCompanyId != null &&
    Number(targetCompanyId) !== Number(userCompanyId)
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  logger.info(
    {
      requesterId: requestUserId,
      requesterProfile: req.user.profile,
      requesterCompanyId: userCompanyId,
      targetCompanyId,
      supportMode: supportMode === true
    },
    "[CompanyUsers] list_start"
  );

  const users = await SimpleListService({
    companyId: targetCompanyId
  });

  logger.info(
    {
      targetCompanyId,
      count: users.length,
      userIds: users.map((u) => u.id)
    },
    "[CompanyUsers] list_result"
  );

  return res.status(200).json(users);
};

export const transferList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { searchParam } = req.query as { searchParam?: string };
  const { companyId } = req.user;

  const { users, count, hasMore } = await ListUsersForTransferService({
    searchParam,
    companyId
  });

  return res.status(200).json({ users, count, hasMore });
};

export const setLanguage = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { newLanguage } = req.params;

  if (newLanguage !== "pt" && newLanguage !== "en" && newLanguage !== "es")
    throw new AppError("ERR_INTERNAL_SERVER_ERROR", 500);

  await SetLanguageCompanyService(companyId, newLanguage);

  return res.status(200).json({ message: "Language updated successfully" });
};
