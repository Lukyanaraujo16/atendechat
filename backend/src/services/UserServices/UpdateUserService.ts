import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import { getFirstYupErrorMessage, optionalPasswordSchema } from "../../utils/passwordPolicy";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";
import {
  clearUserFeaturePermissions,
  loadPlanFeatureMapForCompanyId,
  seedDefaultUserFeaturePermissions,
  setUserFeaturePermissionsFromAdminInput
} from "../UserFeaturePermission/UserFeaturePermissionService";
import { logger } from "../../utils/logger";

function hasFeaturePermissionPayload(
  featurePermissions: Record<string, unknown> | undefined
): boolean {
  return (
    featurePermissions != null &&
    typeof featurePermissions === "object" &&
    Object.keys(featurePermissions).length > 0
  );
}

const ALLOWED_PROFILES = ["admin", "user", "supervisor"];

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
  featurePermissions?: Record<string, unknown>;
  active?: boolean;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
  /** Super Admin em modo suporte a editar o próprio perfil: o alvo não pertence ao companyId do JWT */
  skipCompanyScopeForShow?: boolean;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId,
  skipCompanyScopeForShow
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(
    userId,
    skipCompanyScopeForShow ? undefined : companyId
  );

  const oldProfile = user.profile;

  const requestUser = await User.findByPk(requestUserId, {
    attributes: ["id", "profile", "super", "companyId"]
  });

  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 403);
  }

  if (requestUser.super === false && userData.companyId !== companyId) {
    throw new AppError("O usuário não pertence à esta empresa");
  }

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId,
    allTicket,
    featurePermissions,
    active
  } = userData;

  const schema = Yup.object().shape({
    email: Yup.string()
      .transform(v => (v === "" || v === undefined ? undefined : v))
      .email()
      .nullable(),
    password: optionalPasswordSchema,
    allTicket: Yup.mixed().nullable()
  });

  try {
    await schema.validate({ email, password, allTicket });
  } catch (err: unknown) {
    throw new AppError(getFirstYupErrorMessage(err));
  }

  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 120) {
      throw new AppError("Nome deve ter entre 2 e 120 caracteres.", 400);
    }
  }

  if (profile !== undefined && !ALLOWED_PROFILES.includes(profile)) {
    throw new AppError("ERR_INVALID_PROFILE", 400);
  }

  const willUpdatePassword =
    password !== undefined &&
    password !== null &&
    String(password).trim().length > 0;

  const featurePermissionPayload = hasFeaturePermissionPayload(featurePermissions);

  if (featurePermissionPayload && !skipCompanyScopeForShow) {
    if (Number(userId) === Number(requestUserId)) {
      logger.warn(
        {
          requesterId: requestUserId,
          targetUserId: userId,
          targetProfile: user.profile
        },
        "[UserUpdate] permission_denied"
      );
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    if (user.profile === "admin") {
      logger.warn(
        {
          requesterId: requestUserId,
          targetUserId: userId,
          targetProfile: user.profile
        },
        "[UserUpdate] permission_denied"
      );
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    if (!user.companyId) {
      logger.warn(
        {
          requesterId: requestUserId,
          targetUserId: userId
        },
        "[UserUpdate] permission_denied"
      );
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  if (willUpdatePassword) {
    logger.info(
      {
        requesterId: requestUserId,
        targetUserId: userId,
        isSelf: Number(userId) === Number(requestUserId)
      },
      "[UserUpdate] password_update_allowed"
    );
  }

  if (active !== undefined) {
    const canManageStatus =
      requestUser.super === true ||
      requestUser.profile === "admin" ||
      requestUser.profile === "superadmin" ||
      skipCompanyScopeForShow === true;
    if (!canManageStatus) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    if (Number(userId) === Number(requestUserId) && active === false) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const emailNorm =
    email !== undefined && email !== null && String(email).trim() !== ""
      ? String(email).trim().toLowerCase()
      : undefined;

  if (
    emailNorm !== undefined &&
    emailNorm !== String(user.email || "").toLowerCase()
  ) {
    const duplicate = await User.findOne({
      where: {
        email: emailNorm,
        companyId: user.companyId,
        id: { [Op.ne]: user.id }
      }
    });
    if (duplicate) {
      throw new AppError("An user with this email already exists.", 400);
    }
  }

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    updates.name = name.trim();
  }
  if (emailNorm !== undefined) {
    updates.email = emailNorm;
  }
  if (profile !== undefined) {
    updates.profile = profile;
  }
  if (whatsappId !== undefined) {
    updates.whatsappId = whatsappId || null;
  }
  if (allTicket !== undefined) {
    updates.allTicket = allTicket;
  }
  if (willUpdatePassword) {
    updates.password = password;
    updates.mustChangePassword = false;
  }
  if (active !== undefined) {
    const nextActive = active === true;
    if (user.active !== nextActive) {
      updates.active = nextActive;
      if (!nextActive) {
        updates.tokenVersion = (user.tokenVersion || 0) + 1;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await user.update(updates);
  }

  await user.$set("queues", queueIds);

  await user.reload();

  const newProfile = user.profile;
  if (oldProfile !== newProfile) {
    if (newProfile === "admin") {
      await clearUserFeaturePermissions(user.id);
    } else if (
      (newProfile === "user" || newProfile === "supervisor") &&
      oldProfile === "admin" &&
      user.companyId
    ) {
      const planMap = await loadPlanFeatureMapForCompanyId(user.companyId);
      await seedDefaultUserFeaturePermissions(
        user.id,
        user.companyId,
        newProfile,
        planMap,
        { actorUserId: requestUser.id }
      );
    }
  }

  if (featurePermissionPayload && !skipCompanyScopeForShow) {
    const planMap = await loadPlanFeatureMapForCompanyId(user.companyId!);
    await setUserFeaturePermissionsFromAdminInput({
      targetUserId: user.id,
      companyId: user.companyId!,
      planMap,
      input: featurePermissions!,
      actor: requestUser
    });
  }

  const company = await Company.findByPk(user.companyId);

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues
  };

  logger.info(
    {
      requesterId: requestUserId,
      targetUserId: user.id,
      targetCompanyId: user.companyId
    },
    "[UserUpdate] saved"
  );

  return serializedUser;
};

export default UpdateUserService;
