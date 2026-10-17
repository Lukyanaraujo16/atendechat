import { Op, Sequelize, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import Plan from "../../models/Plan";
import { isInternalUser } from "../../helpers/isInternalUser";
import { isValidEmail } from "../../helpers/brDocuments";
import { strongPasswordSchema } from "../../utils/passwordPolicy";

/**
 * Gestão de usuários de uma empresa pelo Super Admin (Fase 8.4).
 * Regras comuns: isolamento por companyId, nunca expor hash, sem promoção a `super`.
 */

/** Perfis aceitos por esta rota (super/superadmin nunca). */
export const SAAS_COMPANY_USER_PROFILES = ["admin", "user"] as const;
export type SaasCompanyUserProfile = typeof SAAS_COMPANY_USER_PROFILES[number];

/** Atributos públicos do usuário — nunca inclui passwordHash/tokens. */
export const PUBLIC_USER_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "profile",
  "active",
  "super",
  "online",
  "createdAt"
];

export interface PublicCompanyUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  active: boolean;
  super: boolean;
  online: boolean;
  createdAt: Date;
}

export function serializeCompanyUser(user: User): PublicCompanyUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    active: user.active !== false,
    super: user.super === true,
    online: user.online === true,
    createdAt: user.createdAt
  };
}

/** Snapshot para auditoria (sem dados sensíveis). */
export function auditSnapshot(user: Pick<User, "name" | "email" | "profile" | "active">): Record<string, unknown> {
  return {
    name: user.name,
    email: user.email,
    profile: user.profile,
    active: user.active !== false
  };
}

export function parseCompanyId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400, "Empresa inválida.");
  }
  return id;
}

export async function assertCompanyExists(
  companyId: number,
  transaction?: Transaction
): Promise<Company> {
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "name", "planId"],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404, "Empresa não encontrada.");
  }
  return company;
}

/** Busca usuário garantindo que pertence à empresa (outra empresa → 404). */
export async function findCompanyUserOrFail(
  companyId: number,
  userId: unknown,
  transaction?: Transaction
): Promise<User> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("ERR_USER_NOT_FOUND", 404, "Usuário não encontrado nesta empresa.");
  }
  const user = await User.findOne({
    where: { id, companyId },
    transaction
  });
  if (!user) {
    throw new AppError("ERR_USER_NOT_FOUND", 404, "Usuário não encontrado nesta empresa.");
  }
  return user;
}

/** Usuários internos da plataforma (super/superadmin) não são geridos por esta rota. */
export function assertNotPlatformUser(user: User): void {
  if (isInternalUser({ super: user.super, profile: user.profile })) {
    throw new AppError(
      "ERR_SUPER_USER_PROTECTED",
      403,
      "Usuários Super Admin não podem ser alterados por esta tela."
    );
  }
}

export function normalizeName(raw: unknown): string {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) {
    throw new AppError(
      "ERR_INVALID_NAME",
      400,
      "Nome deve ter entre 2 e 120 caracteres."
    );
  }
  return name;
}

export function normalizeEmail(raw: unknown): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new AppError("ERR_INVALID_EMAIL", 400, "E-mail inválido.");
  }
  return email;
}

export function normalizeProfile(raw: unknown): SaasCompanyUserProfile {
  const profile = String(raw ?? "").trim();
  if (!(SAAS_COMPANY_USER_PROFILES as readonly string[]).includes(profile)) {
    throw new AppError(
      "ERR_INVALID_PROFILE",
      400,
      "Perfil inválido. Use \"admin\" ou \"user\"."
    );
  }
  return profile as SaasCompanyUserProfile;
}

const PASSWORD_MESSAGES: Record<string, string> = {
  ERR_PASSWORD_REQUIRED: "Informe a senha.",
  ERR_PASSWORD_TOO_SHORT: "A senha deve ter no mínimo 8 caracteres.",
  ERR_PASSWORD_TOO_LONG: "A senha é longa demais.",
  ERR_PASSWORD_POLICY:
    "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula e número."
};

/** Mesma política de senha do restante do sistema (utils/passwordPolicy). */
export function assertValidPassword(raw: unknown): string {
  const password = typeof raw === "string" ? raw : "";
  if (!password) {
    throw new AppError("ERR_PASSWORD_REQUIRED", 400, PASSWORD_MESSAGES.ERR_PASSWORD_REQUIRED);
  }
  try {
    strongPasswordSchema.validateSync(password);
  } catch (err: unknown) {
    const code =
      (err as { errors?: string[] })?.errors?.[0] || "ERR_PASSWORD_POLICY";
    throw new AppError(code, 400, PASSWORD_MESSAGES[code] || PASSWORD_MESSAGES.ERR_PASSWORD_POLICY);
  }
  return password;
}

/** E-mail é único globalmente (constraint `Users.email` e login por e-mail). */
export async function assertEmailAvailable(
  email: string,
  exceptUserId?: number,
  transaction?: Transaction
): Promise<void> {
  const where: any = {
    [Op.and]: [
      Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("email")), email)
    ]
  };
  if (exceptUserId != null) {
    where.id = { [Op.ne]: exceptUserId };
  }
  const existing = await User.findOne({ where, attributes: ["id"], transaction });
  if (existing) {
    throw new AppError(
      "ERR_EMAIL_ALREADY_IN_USE",
      409,
      "Este e-mail já está em uso por outro usuário."
    );
  }
}

/** Quantidade de admins ativos da empresa, excluindo opcionalmente um usuário. */
export async function countOtherActiveAdmins(
  companyId: number,
  excludeUserId: number,
  transaction?: Transaction
): Promise<number> {
  return User.count({
    where: {
      companyId,
      profile: "admin",
      active: true,
      id: { [Op.ne]: excludeUserId }
    },
    transaction
  });
}

/** Desativar ou rebaixar o último admin ativo → 409. */
export async function assertNotLastActiveAdmin(
  user: User,
  transaction?: Transaction
): Promise<void> {
  if (user.profile !== "admin" || user.active === false) return;
  const others = await countOtherActiveAdmins(Number(user.companyId), user.id, transaction);
  if (others < 1) {
    throw new AppError(
      "ERR_LAST_ADMIN",
      409,
      "Não é possível desativar ou rebaixar o último administrador ativo da empresa."
    );
  }
}

/**
 * Limite de usuários do plano (Plan.users). Conta apenas usuários ativos, já que
 * nesta fase não há exclusão física (desativados não ocupam vaga).
 */
export async function assertPlanUserLimit(
  company: Company,
  transaction?: Transaction
): Promise<void> {
  if (!company.planId) return;
  const plan = await Plan.findByPk(company.planId, {
    attributes: ["id", "users"],
    transaction
  });
  const limit = Number(plan?.users ?? 0);
  if (!Number.isFinite(limit) || limit <= 0) return;
  const activeCount = await User.count({
    where: { companyId: company.id, active: true },
    transaction
  });
  if (activeCount >= limit) {
    throw new AppError(
      "ERR_PLAN_USER_LIMIT",
      409,
      `Limite de usuários do plano atingido (${limit}).`
    );
  }
}
