import { Op } from "sequelize";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import User from "../../models/User";
import { logger } from "../../utils/logger";

export type SignupActivationSource = "login" | "password_reset";

/**
 * Quando o admin da empresa completa o onboarding (definição de senha no link do convite
 * ou primeiro login válido), atualiza o pedido de cadastro público.
 * `firstLoginAt` é preenchido apenas no primeiro login com sucesso.
 */
const MarkSignupRequestActivatedForUserService = async (
  user: User,
  source: SignupActivationSource = "login"
): Promise<void> => {
  if (!user?.companyId || !user.email) {
    return;
  }

  const email = String(user.email).trim().toLowerCase();
  if (!email) {
    return;
  }

  const row = await CompanySignupRequest.findOne({
    where: {
      createdCompanyId: user.companyId,
      status: { [Op.in]: ["approved", "invited", "activated"] }
    }
  });

  if (!row) {
    return;
  }

  const rowEmail = String(row.email || "").trim().toLowerCase();
  if (rowEmail !== email) {
    return;
  }

  const now = new Date();

  if (row.status === "activated") {
    if (source === "login" && !row.firstLoginAt) {
      row.firstLoginAt = now;
      await row.save();
      logger.info(
        `[SignupOnboarding] signupRequest=${row.id} firstLoginAt userId=${user.id}`
      );
    }
    return;
  }

  if (row.status !== "approved" && row.status !== "invited") {
    return;
  }

  row.status = "activated";
  row.activatedAt = row.activatedAt || now;
  if (source === "login") {
    row.firstLoginAt = row.firstLoginAt || now;
  }

  await row.save();

  logger.info(
    `[SignupOnboarding] signupRequest=${row.id} companyId=${user.companyId} userId=${user.id} status=activated source=${source}`
  );
};

export default MarkSignupRequestActivatedForUserService;
