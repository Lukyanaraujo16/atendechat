import AppError from "../../errors/AppError";
import sequelize from "../../database";
import User from "../../models/User";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import {
  PublicCompanyUser,
  assertCompanyExists,
  assertNotLastActiveAdmin,
  assertNotPlatformUser,
  assertPlanUserLimit,
  findCompanyUserOrFail,
  serializeCompanyUser
} from "./companyUserHelpers";

interface Request {
  companyId: number;
  userId: number | string;
  actorUserId: number;
  active: unknown;
}

/**
 * Ativa/desativa usuário (sem exclusão física).
 * Desativar invalida as sessões (tokenVersion++) e protege o último admin ativo.
 */
const SetCompanyUserActiveService = async ({
  companyId,
  userId,
  actorUserId,
  active
}: Request): Promise<PublicCompanyUser> => {
  if (typeof active !== "boolean") {
    throw new AppError(
      "ERR_INVALID_ACTIVE",
      400,
      "Informe se o usuário deve ficar ativo (true) ou inativo (false)."
    );
  }

  let changed = false;
  let previous = true;
  const user: User = await sequelize.transaction(async transaction => {
    const company = await assertCompanyExists(companyId, transaction);
    const target = await findCompanyUserOrFail(companyId, userId, transaction);
    assertNotPlatformUser(target);
    previous = target.active !== false;
    if (previous === active) return target;

    if (!active) {
      if (Number(target.id) === Number(actorUserId)) {
        throw new AppError(
          "ERR_CANNOT_DEACTIVATE_SELF",
          403,
          "Não é possível desativar a própria conta."
        );
      }
      await assertNotLastActiveAdmin(target, transaction);
      await target.update(
        {
          active: false,
          online: false,
          tokenVersion: (target.tokenVersion || 0) + 1
        },
        { transaction }
      );
    } else {
      await assertPlanUserLimit(company, transaction);
      await target.update({ active: true }, { transaction });
    }
    changed = true;
    return target;
  });

  if (changed) {
    await createCompanyLog({
      companyId,
      action: active ? "user_activate" : "user_deactivate",
      userId: actorUserId,
      metadata: {
        targetUserId: user.id,
        before: { active: previous },
        after: { active }
      }
    });
  }

  return serializeCompanyUser(user);
};

export default SetCompanyUserActiveService;
