import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import User from "../../models/User";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import { SerializeUser } from "../../helpers/SerializeUser";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
}

/**
 * O próprio super admin atualiza nome, e-mail e/ou senha (sem alterar flag super).
 */
const UpdatePlatformProfileService = async (
  userId: number,
  userData: UserData
) => {
  const user = await User.findByPk(userId, {
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

  if (!user.super) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { email, password, name } = userData;

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

export default UpdatePlatformProfileService;
