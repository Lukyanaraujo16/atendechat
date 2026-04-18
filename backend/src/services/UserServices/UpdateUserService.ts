import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

const ALLOWED_PROFILES = ["admin", "user", "supervisor"];

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
  /** Super Admin em modo suporte a editar o próprio perfil: o alvo não pertence ao companyId do JWT */
  skipCompanyScopeForShow?: boolean;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId,
  skipCompanyScopeForShow
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(
    userId,
    skipCompanyScopeForShow ? undefined : companyId
  );

  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 403);
  }

  if (requestUser.super === false && userData.companyId !== companyId) {
    throw new AppError("O usuário não pertence à esta empresa");
  }

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId,
    allTicket
  } = userData;

  const schema = Yup.object().shape({
    email: Yup.string()
      .transform(v => (v === "" || v === undefined ? undefined : v))
      .email()
      .nullable(),
    password: Yup.mixed().test(
      "pwd",
      "Senha deve ter entre 5 e 128 caracteres.",
      val =>
        val === undefined ||
        val === null ||
        val === "" ||
        (typeof val === "string" &&
          String(val).trim().length >= 5 &&
          String(val).trim().length <= 128)
    ),
    allTicket: Yup.mixed().nullable()
  });

  try {
    await schema.validate({ email, password, allTicket });
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
        companyId: user.companyId,
        id: { [Op.ne]: user.id }
      }
    });
    if (duplicate) {
      throw new AppError("An user with this email already exists.", 400);
    }
  }

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    updates.name = name.trim();
  }
  if (emailNorm !== undefined) {
    updates.email = emailNorm;
  }
  if (profile !== undefined) {
    updates.profile = profile;
  }
  if (whatsappId !== undefined) {
    updates.whatsappId = whatsappId || null;
  }
  if (allTicket !== undefined) {
    updates.allTicket = allTicket;
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

  await user.$set("queues", queueIds);

  await user.reload();

  const company = await Company.findByPk(user.companyId);

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues
  };

  return serializedUser;
};

export default UpdateUserService;
