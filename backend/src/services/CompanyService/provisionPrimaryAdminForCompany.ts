import { randomBytes } from "crypto";
import { Transaction, UniqueConstraintError } from "sequelize";
import Company from "../../models/Company";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  getFirstYupErrorMessage,
  strongPasswordSchema,
  generateTemporaryPassword
} from "../../utils/passwordPolicy";
import sendPasswordResetEmail, {
  isPasswordResetMailConfigured
} from "../PasswordReset/sendPasswordResetEmail";
import { PRIMARY_ADMIN_INVITE_TTL_MS } from "../../constants/onboarding";

type ProvisionOpts = {
  company: Company;
  adminEmail: string;
  adminName: string;
  passwordPlain?: string | null;
  transaction?: Transaction;
};

export type ProvisionPrimaryAdminResult = {
  email: string;
  name: string;
  mustChangePassword: boolean;
  /** Só quando a senha é gerada automaticamente (SaaS / aprovação sem senha explícita). */
  temporaryPassword?: string;
  /** E-mail de convite com link para /forgetpsw (token). */
  inviteEmailSent?: boolean;
};

/**
 * Garante um utilizador `admin` para a empresa.
 * — Com `passwordPlain`: valida política e cria utilizador (troca de senha não forçada).
 * — Sem senha: gera palavra-passe provisória + `mustChangePassword`, envia convite por e-mail quando SMTP disponível.
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

  const createUser = async (fields: Partial<User>) => {
    try {
      await User.create(fields as User, { transaction: tx });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw new AppError(
          "ERR_EMAIL_ALREADY_IN_USE",
          400,
          "Este e-mail já está associado a outro utilizador."
        );
      }
      throw err;
    }
  };

  if (pwdTrim.length > 0) {
    try {
      await strongPasswordSchema.validate(pwdTrim);
    } catch (err: unknown) {
      throw new AppError(getFirstYupErrorMessage(err), 400);
    }
    await createUser({
      name: adminName,
      email,
      password: pwdTrim,
      profile: "admin",
      companyId: opts.company.id,
      mustChangePassword: false
    });
    return {
      email,
      name: adminName,
      mustChangePassword: false
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const token = randomBytes(32).toString("hex");

  await createUser({
    name: adminName,
    email,
    password: temporaryPassword,
    profile: "admin",
    companyId: opts.company.id,
    mustChangePassword: true,
    resetPassword: token,
    passwordResetExpires: new Date(Date.now() + PRIMARY_ADMIN_INVITE_TTL_MS)
  });

  let inviteEmailSent = false;
  if (await isPasswordResetMailConfigured()) {
    try {
      await sendPasswordResetEmail({
        to: email,
        token,
        userName: adminName,
        kind: "invite"
      });
      inviteEmailSent = true;
    } catch (err) {
      console.error("[provisionPrimaryAdmin] Falha ao enviar e-mail de convite:", err);
      inviteEmailSent = false;
    }
  } else {
    console.warn(
      "[provisionPrimaryAdmin] SMTP não configurado — convite por e-mail não enviado; use credenciais devolvidas à API."
    );
  }

  return {
    email,
    name: adminName,
    mustChangePassword: true,
    temporaryPassword,
    inviteEmailSent
  };
};

export default provisionPrimaryAdminForCompany;
