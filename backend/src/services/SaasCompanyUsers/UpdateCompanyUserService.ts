import { UniqueConstraintError } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import User from "../../models/User";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import {
  clearUserFeaturePermissions,
  loadPlanFeatureMapForCompanyId,
  seedDefaultUserFeaturePermissions
} from "../UserFeaturePermission/UserFeaturePermissionService";
import { logger } from "../../utils/logger";
import {
  PublicCompanyUser,
  assertCompanyExists,
  assertEmailAvailable,
  assertNotLastActiveAdmin,
  assertNotPlatformUser,
  auditSnapshot,
  findCompanyUserOrFail,
  normalizeEmail,
  normalizeName,
  normalizeProfile,
  serializeCompanyUser
} from "./companyUserHelpers";

interface Request {
  companyId: number;
  userId: number | string;
  actorUserId: number;
  data: {
    name?: unknown;
    email?: unknown;
    profile?: unknown;
  };
}

function has(obj: unknown, key: string): boolean {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

const UpdateCompanyUserService = async ({
  companyId,
  userId,
  actorUserId,
  data
}: Request): Promise<PublicCompanyUser> => {
  const updates: Record<string, unknown> = {};
  if (has(data, "name") && data.name !== undefined) updates.name = normalizeName(data.name);
  if (has(data, "email") && data.email !== undefined) updates.email = normalizeEmail(data.email);
  if (has(data, "profile") && data.profile !== undefined) {
    updates.profile = normalizeProfile(data.profile);
  }

  let before: Record<string, unknown> = {};
  let previousProfile = "";
  let user: User;
  try {
    user = await sequelize.transaction(async transaction => {
      await assertCompanyExists(companyId, transaction);
      const target = await findCompanyUserOrFail(companyId, userId, transaction);
      assertNotPlatformUser(target);
      before = auditSnapshot(target);
      previousProfile = target.profile;

      if (updates.email !== undefined && updates.email === String(target.email || "").toLowerCase()) {
        delete updates.email;
      }
      if (updates.email !== undefined) {
        await assertEmailAvailable(String(updates.email), target.id, transaction);
      }
      if (updates.profile !== undefined && updates.profile === target.profile) {
        delete updates.profile;
      }
      if (updates.profile !== undefined && target.profile === "admin") {
        await assertNotLastActiveAdmin(target, transaction);
      }
      if (updates.name !== undefined && updates.name === target.name) {
        delete updates.name;
      }

      if (Object.keys(updates).length > 0) {
        await target.update(updates, { transaction });
      }
      return target;
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new AppError(
        "ERR_EMAIL_ALREADY_IN_USE",
        409,
        "Este e-mail já está em uso por outro usuário."
      );
    }
    throw err;
  }

  if (updates.profile !== undefined && updates.profile !== previousProfile) {
    try {
      if (updates.profile === "admin") {
        await clearUserFeaturePermissions(user.id);
      } else {
        const planMap = await loadPlanFeatureMapForCompanyId(companyId);
        await seedDefaultUserFeaturePermissions(
          user.id,
          companyId,
          String(updates.profile),
          planMap,
          { actorUserId }
        );
      }
    } catch (err) {
      logger.warn(
        { err, companyId, userId: user.id },
        "[SaasCompanyUsers] sync_feature_permissions_failed"
      );
    }
  }

  if (Object.keys(updates).length > 0) {
    const after = auditSnapshot(user);
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
    await createCompanyLog({
      companyId,
      action: "user_update",
      userId: actorUserId,
      metadata: {
        targetUserId: user.id,
        before: changedBefore,
        after: changedAfter
      }
    });
  }

  return serializeCompanyUser(user);
};

export default UpdateCompanyUserService;
