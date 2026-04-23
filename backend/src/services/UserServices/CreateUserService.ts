import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { getFirstYupErrorMessage, requiredPasswordSchema } from "../../utils/passwordPolicy";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";

const ALLOWED_PROFILES = ["admin", "user", "supervisor"];

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profile?: string;
  whatsappId?: number;
  allTicket?: string;
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "admin",
  whatsappId,
  allTicket
}: Request): Promise<Response> => {
  if (!ALLOWED_PROFILES.includes(profile)) {
    throw new AppError("ERR_INVALID_PROFILE", 400);
  }

  if (companyId !== undefined) {
    const company = await Company.findOne({
      where: {
        id: companyId
      },
      include: [{ model: Plan, as: "plan" }]
    });

    if (company !== null) {
      const usersCount = await User.count({
        where: {
          companyId
        }
      });

      if (usersCount >= company.plan.users) {
        throw new AppError(
          `Número máximo de usuários já alcançado: ${usersCount}`
        );
      }
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2).max(120),
    email: Yup.string()
      .email()
      .required()
      .transform(v => (typeof v === "string" ? v.trim().toLowerCase() : v))
      .test(
        "Check-email-company",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const where: Record<string, unknown> = {
            email: value
          };
          if (companyId !== undefined && companyId !== null) {
            where.companyId = companyId;
          }
          const emailExists = await User.findOne({ where });
          return !emailExists;
        }
      ),
    password: requiredPasswordSchema
  });

  try {
    await schema.validate({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim()
    });
  } catch (err: unknown) {
    throw new AppError(getFirstYupErrorMessage(err));
  }

  const user = await User.create(
    {
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      companyId,
      profile,
      whatsappId: whatsappId || null,
      allTicket
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);

  await user.reload();

  const serializedUser = await SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;
