import sequelize from "../../database";
import User from "../../models/User";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import {
  PublicCompanyUser,
  assertCompanyExists,
  assertNotPlatformUser,
  assertValidPassword,
  findCompanyUserOrFail,
  serializeCompanyUser
} from "./companyUserHelpers";

interface Request {
  companyId: number;
  userId: number | string;
  actorUserId: number;
  password: unknown;
}

/**
 * Define nova senha pelo Super Admin: força troca no próximo acesso
 * (mustChangePassword) e invalida sessões existentes (tokenVersion++).
 * O hash é gerado pelo hook do model User; a senha nunca é registrada em log.
 */
const ResetCompanyUserPasswordService = async ({
  companyId,
  userId,
  actorUserId,
  password
}: Request): Promise<PublicCompanyUser> => {
  const plain = assertValidPassword(password);

  const user: User = await sequelize.transaction(async transaction => {
    await assertCompanyExists(companyId, transaction);
    const target = await findCompanyUserOrFail(companyId, userId, transaction);
    assertNotPlatformUser(target);
    await target.update(
      {
        password: plain,
        mustChangePassword: true,
        tokenVersion: (target.tokenVersion || 0) + 1,
        online: false,
        resetPassword: null,
        passwordResetExpires: null
      },
      { transaction }
    );
    return target;
  });

  await createCompanyLog({
    companyId,
    action: "user_password_reset",
    userId: actorUserId,
    metadata: {
      targetUserId: user.id,
      mustChangePassword: true,
      sessionsInvalidated: true
    }
  });

  return serializeCompanyUser(user);
};

export default ResetCompanyUserPasswordService;
