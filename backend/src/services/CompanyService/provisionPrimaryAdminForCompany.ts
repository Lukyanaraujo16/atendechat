import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { Transaction } from "sequelize";
import Company from "../../models/Company";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  getFirstYupErrorMessage,
  strongPasswordSchema
} from "../../utils/passwordPolicy";
import sendPasswordResetEmail from "../PasswordReset/sendPasswordResetEmail";
import { PRIMARY_ADMIN_INVITE_TTL_MS } from "../../constants/onboarding";

type ProvisionOpts = {
  company: Company;
  adminEmail: string;
  adminName: string;
  passwordPlain?: string | null;
  transaction?: Transaction;
};

export type ProvisionPrimaryAdminResult = {
  /** true = e-mail de convite enviado; false = falha; undefined = fluxo com senha na criação */
  inviteEmailSent?: boolean;
};

/**
 * Cria o utilizador admin da empresa: com senha forte ou, se não houver senha,
 * com hash placeholder + token (e-mail de convite com link para /forgetpsw).
 * Substitui o antigo fallback "123456".
 */
const provisionPrimaryAdminForCompany = async (
  opts: ProvisionOpts
): Promise<ProvisionPrimaryAdminResult> => {
  const email = String(opts.adminEmail || "")
    .trim()
    .toLowerCase();
  if (!email) {
    throw new AppError("ERR_COMPANY_EMAIL_REQUIRED", 400);
  }

  const adminName =
    String(opts.adminName || "").trim() || String(opts.company.name || "");

  const pwdTrim =
    opts.passwordPlain !== undefined && opts.passwordPlain !== null
      ? String(opts.passwordPlain).trim()
      : "";

  const tx = opts.transaction;

  if (pwdTrim.length > 0) {
    try {
      await strongPasswordSchema.validate(pwdTrim);
    } catch (err: unknown) {
      throw new AppError(getFirstYupErrorMessage(err), 400);
    }
    await User.create(
      {
        name: adminName,
        email,
        password: pwdTrim,
        profile: "admin",
        companyId: opts.company.id
      },
      { transaction: tx }
    );
    return {};
  }

  const token = randomBytes(32).toString("hex");
  const placeholder = randomBytes(32).toString("hex");
  const passwordHash = await hash(placeholder, 8);

  await User.create(
    {
      name: adminName,
      email,
      passwordHash,
      profile: "admin",
      companyId: opts.company.id,
      resetPassword: token,
      passwordResetExpires: new Date(Date.now() + PRIMARY_ADMIN_INVITE_TTL_MS)
    },
    { transaction: tx }
  );

  try {
    await sendPasswordResetEmail({
      to: email,
      token,
      userName: adminName,
      kind: "invite"
    });
    return { inviteEmailSent: true };
  } catch (err) {
    console.error("[provisionPrimaryAdmin] Falha ao enviar e-mail de convite:", err);
    return { inviteEmailSent: false };
  }
};

export default provisionPrimaryAdminForCompany;
