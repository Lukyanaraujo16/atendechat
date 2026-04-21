import * as Yup from "yup";

import AppError from "../../errors/AppError";
import User from "../../models/User";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import { SerializeUser } from "../../helpers/SerializeUser";

const ALLOWED_PROFILES = ["admin", "user", "supervisor"];

export type CreatePlatformSuperUserBody = {
  name: string;
  email: string;
  password: string;
  profile?: string;
  /** Por omissão `true` neste endpoint (novo super admin). */
  super?: boolean;
  companyId?: number | string | null;
};

function parseCompanyIdForCreate(
  body: CreatePlatformSuperUserBody,
  superFlag: boolean
): number | null {
  const has = Object.prototype.hasOwnProperty.call(body, "companyId");
  const raw = body.companyId;

  if (!superFlag) {
    if (
      !has ||
      raw === null ||
      raw === undefined ||
      raw === "" ||
      raw === "null"
    ) {
      throw new AppError(
        "ERR_COMPANY_REQUIRED",
        400,
        "Utilizador sem privilégio super deve estar vinculado a uma empresa."
      );
    }
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(n)) {
      throw new AppError("ERR_INVALID_COMPANY_ID", 400);
    }
    return n;
  }

  if (
    !has ||
    raw === null ||
    raw === undefined ||
    raw === "" ||
    raw === "null"
  ) {
    return null;
  }
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }
  return n;
}

/**
 * Criação global de utilizador pelo painel SaaS (super admin).
 * Super admin pode ter `companyId` nulo (só gestão SaaS).
 * Utilizador não-super deve ter empresa e respeita limite do plano.
 */
const CreatePlatformSuperUserService = async (body: CreatePlatformSuperUserBody) => {
  const profile = body.profile ?? "admin";
  const superFlag =
    body.super !== undefined && body.super !== null
      ? Boolean(body.super)
      : true;

  if (!ALLOWED_PROFILES.includes(profile)) {
    throw new AppError("ERR_INVALID_PROFILE", 400);
  }

  const name = String(body.name || "").trim();
  const password = body.password;
  const emailRaw = body.email;

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2).max(120),
    email: Yup.string().email().required(),
    password: Yup.string().required().min(5).max(128)
  });

  try {
    await schema.validate(
      { name, email: emailRaw, password },
      { abortEarly: false }
    );
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const emailNorm = String(emailRaw).trim().toLowerCase();

  const companyId = parseCompanyIdForCreate(body, superFlag);

  if (companyId != null) {
    const company = await Company.findOne({
      where: { id: companyId },
      include: [{ model: Plan, as: "plan" }]
    });
    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }
    const usersCount = await User.count({ where: { companyId } });
    if (company.plan && usersCount >= company.plan.users) {
      throw new AppError(
        `Número máximo de usuários já alcançado: ${usersCount}`
      );
    }
  }

  const duplicate = await User.findOne({
    where: { email: emailNorm }
  });
  if (duplicate) {
    throw new AppError("ERR_EMAIL_IN_USE", 400, "Este e-mail já está em uso.");
  }

  const user = await User.create({
    email: emailNorm,
    password,
    name,
    companyId,
    profile,
    super: superFlag
  });

  await user.reload({
    include: [{ model: Company, required: false }, "queues"]
  });

  return SerializeUser(user);
};

export default CreatePlatformSuperUserService;
