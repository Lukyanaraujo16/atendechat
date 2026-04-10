import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import User from "../../models/User";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import { SerializeUser } from "../../helpers/SerializeUser";

const ALLOWED_PROFILES = ["admin", "user", "supervisor"];

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  super?: boolean;
}

interface Params {
  targetUserId: number;
  userData: UserData;
}

/**
 * Atualização global de utilizador por super admin (nome, email, perfil, super, senha).
 * Não altera companyId nesta fase (ver notas no controller).
 */
const UpdatePlatformSuperUserService = async ({
  targetUserId,
  userData
}: Params) => {
  const user = await User.findByPk(targetUserId, {
    include: [
      {
        model: Company,
        include: [{ model: Setting }]
      },
      "queues"
    ]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const { email, password, profile, name, super: superFlag } = userData;

  const schema = Yup.object().shape({
    email: Yup.string()
      .transform((v) => (v === "" || v === undefined ? undefined : v))
      .email()
      .nullable(),
    password: Yup.mixed().test(
      "pwd",
      "Senha deve ter entre 5 e 128 caracteres.",
      (val) =>
        val === undefined ||
        val === null ||
        val === "" ||
        (typeof val === "string" &&
          String(val).trim().length >= 5 &&
          String(val).trim().length <= 128)
    )
  });

  try {
    await schema.validate({ email, password });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 120) {
      throw new AppError("Nome deve ter entre 2 e 120 caracteres.", 400);
    }
  }

  if (profile !== undefined && !ALLOWED_PROFILES.includes(profile)) {
    throw new AppError("ERR_INVALID_PROFILE", 400);
  }

  const superCount = await User.count({ where: { super: true } });

  if (user.super && superFlag === false) {
    if (superCount <= 1) {
      throw new AppError(
        "ERR_LAST_SUPER_ADMIN",
        400,
        "Tem de existir pelo menos um super administrador na plataforma."
      );
    }
  }

  const emailNorm =
    email !== undefined && email !== null && String(email).trim() !== ""
      ? String(email).trim().toLowerCase()
      : undefined;

  if (
    emailNorm !== undefined &&
    emailNorm !== String(user.email || "").toLowerCase()
  ) {
    const duplicate = await User.findOne({
      where: {
        email: emailNorm,
        id: { [Op.ne]: user.id }
      }
    });
    if (duplicate) {
      throw new AppError("ERR_EMAIL_IN_USE", 400, "Este e-mail já está em uso.");
    }
  }

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    updates.name = String(name).trim();
  }
  if (emailNorm !== undefined) {
    updates.email = emailNorm;
  }
  if (profile !== undefined) {
    updates.profile = profile;
  }
  if (superFlag !== undefined) {
    updates.super = Boolean(superFlag);
  }
  if (
    password !== undefined &&
    password !== null &&
    String(password).trim().length > 0
  ) {
    updates.password = password;
  }

  if (Object.keys(updates).length > 0) {
    await user.update(updates);
  }

  await user.reload({
    include: [
      {
        model: Company,
        include: [{ model: Setting }]
      },
      "queues"
    ]
  });

  return SerializeUser(user);
};

export default UpdatePlatformSuperUserService;
