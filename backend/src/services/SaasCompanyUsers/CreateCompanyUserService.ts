import { UniqueConstraintError } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import User from "../../models/User";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import {
  loadPlanFeatureMapForCompanyId,
  seedDefaultUserFeaturePermissions
} from "../UserFeaturePermission/UserFeaturePermissionService";
import { logger } from "../../utils/logger";
import {
  PublicCompanyUser,
  assertCompanyExists,
  assertEmailAvailable,
  assertPlanUserLimit,
  assertValidPassword,
  auditSnapshot,
  normalizeEmail,
  normalizeName,
  normalizeProfile,
  serializeCompanyUser
} from "./companyUserHelpers";

interface Request {
  companyId: number;
  actorUserId: number;
  data: {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    profile?: unknown;
  };
}

const CreateCompanyUserService = async ({
  companyId,
  actorUserId,
  data
}: Request): Promise<PublicCompanyUser> => {
  const name = normalizeName(data?.name);
  const email = normalizeEmail(data?.email);
  const profile = normalizeProfile(data?.profile ?? "user");
  const password = assertValidPassword(data?.password);

  let user: User;
  try {
    user = await sequelize.transaction(async transaction => {
      const company = await assertCompanyExists(companyId, transaction);
      await assertEmailAvailable(email, undefined, transaction);
      await assertPlanUserLimit(company, transaction);
      return User.create(
        {
          name,
          email,
          password,
          profile,
          companyId,
          super: false,
          active: true,
          // Senha definida pelo Super Admin: o usuário troca no primeiro acesso.
          mustChangePassword: true
        } as User,
        { transaction }
      );
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

  if (profile === "user") {
    try {
      const planMap = await loadPlanFeatureMapForCompanyId(companyId);
      await seedDefaultUserFeaturePermissions(user.id, companyId, profile, planMap, {
        actorUserId
      });
    } catch (err) {
      logger.warn(
        { err, companyId, userId: user.id },
        "[SaasCompanyUsers] seed_feature_permissions_failed"
      );
    }
  }

  await createCompanyLog({
    companyId,
    action: "user_create",
    userId: actorUserId,
    metadata: {
      targetUserId: user.id,
      before: null,
      after: auditSnapshot(user)
    }
  });

  return serializeCompanyUser(user);
};

export default CreateCompanyUserService;
