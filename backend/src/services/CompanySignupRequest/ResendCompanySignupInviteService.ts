import { randomBytes } from "crypto";
import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import User from "../../models/User";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import { PRIMARY_ADMIN_INVITE_TTL_MS } from "../../constants/onboarding";
import sendPasswordResetEmail, {
  isPasswordResetMailConfigured
} from "../PasswordReset/sendPasswordResetEmail";
import { buildSignupRequestListExtras } from "./buildSignupRequestListExtras";

type ResentLogEntry = { at: string; byUserId: number };

function normalizeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Elegibilidade: pedido aprovado (empresa criada), admin existe, onboarding ainda não concluído.
 * Permite reenvio com `approved` (convite nunca confirmado) ou `invited` (reenviar / token expirado).
 * Rotação do token invalida o link anterior — um único convite válido de cada vez.
 */
const ResendCompanySignupInviteService = async (
  requestId: number,
  actorUserId: number
): Promise<Record<string, unknown>> => {
  if (!(await isPasswordResetMailConfigured())) {
    throw new AppError(
      "ERR_MAIL_NOT_CONFIGURED",
      503,
      "E-mail da plataforma não configurado. Configure SMTP em Gestão SaaS → E-mail / SMTP ou variáveis MAIL_*."
    );
  }

  await sequelize.transaction(async (transaction: Transaction) => {
    const signup = await CompanySignupRequest.findByPk(requestId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!signup) {
      throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
    }

    if (signup.status === "activated" || signup.status === "pending" || signup.status === "rejected") {
      throw new AppError("ERR_SIGNUP_INVITE_RESEND_NOT_ALLOWED", 400);
    }

    if (signup.status !== "approved" && signup.status !== "invited") {
      throw new AppError("ERR_SIGNUP_INVITE_RESEND_NOT_ALLOWED", 400);
    }

    if (!signup.createdCompanyId) {
      throw new AppError("ERR_SIGNUP_INVITE_RESEND_NOT_ALLOWED", 400);
    }

    const emailNorm = normalizeEmail(signup.email);
    const companyUsers = await User.findAll({
      where: { companyId: signup.createdCompanyId },
      transaction
    });
    const user = companyUsers.find(u => normalizeEmail(u.email) === emailNorm) || null;

    if (!user) {
      throw new AppError("ERR_SIGNUP_PRIMARY_ADMIN_NOT_FOUND", 404);
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const expires = new Date(Date.now() + PRIMARY_ADMIN_INVITE_TTL_MS);

    user.resetPassword = token;
    user.passwordResetExpires = expires;
    await user.save({ transaction });

    const company = signup.createdCompanyId
      ? await Company.findByPk(signup.createdCompanyId, {
          attributes: ["name"],
          transaction
        })
      : null;
    const companyName = company?.name != null ? String(company.name) : "";

    try {
      await sendPasswordResetEmail({
        to: emailNorm,
        token,
        userName: signup.adminName,
        kind: "invite",
        companyName
      });
    } catch (err) {
      console.error("[ResendCompanySignupInvite] Falha ao enviar e-mail:", err);
      throw new AppError(
        "ERR_SIGNUP_INVITE_EMAIL_FAILED",
        502,
        "Não foi possível enviar o e-mail de convite. Tente novamente."
      );
    }

    const prevLog = Array.isArray(signup.invitationResentHistory)
      ? (signup.invitationResentHistory as ResentLogEntry[])
      : [];
    const entry: ResentLogEntry = { at: now.toISOString(), byUserId: actorUserId };
    const nextLog = [...prevLog, entry].slice(-40);

    signup.invitationSentAt = now;
    if (!signup.firstInvitationSentAt) {
      signup.firstInvitationSentAt = now;
    }
    signup.invitationResentCount = (signup.invitationResentCount || 0) + 1;
    signup.invitationResentHistory = nextLog;
    signup.status = "invited";

    await signup.save({ transaction });
  });

  const row = await CompanySignupRequest.findByPk(requestId, {
    include: [{ model: Plan, required: false }]
  });
  if (!row) {
    throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
  }

  return {
    ...row.toJSON(),
    ...buildSignupRequestListExtras(row)
  };
};

export default ResendCompanySignupInviteService;
