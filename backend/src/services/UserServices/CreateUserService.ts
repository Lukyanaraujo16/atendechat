import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { getFirstYupErrorMessage, requiredPasswordSchema } from "../../utils/passwordPolicy";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import {
  loadPlanFeatureMapForCompanyId,
  seedDefaultUserFeaturePermissions,
  setUserFeaturePermissionsFromAdminInput
} from "../UserFeaturePermission/UserFeaturePermissionService";

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
  featurePermissions?: Record<string, unknown>;
  /** Quem cria o utilizador (rotas autenticadas). Ausente em fluxos públicos → tratado como sistema. */
  actor?: Pick<User, "id" | "profile" | "super"> | null;
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
  allTicket,
  featurePermissions,
  actor
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

  if (
    (profile === "user" || profile === "supervisor") &&
    companyId !== undefined &&
    companyId !== null
  ) {
    const planMap = await loadPlanFeatureMapForCompanyId(companyId);
    const effectiveActor =
      actor ??
      ({ id: 0, profile: "admin", super: true } as Pick<
        User,
        "id" | "profile" | "super"
      >);
    if (featurePermissions && typeof featurePermissions === "object" && Object.keys(featurePermissions).length > 0) {
      await setUserFeaturePermissionsFromAdminInput({
        targetUserId: user.id,
        companyId,
        planMap,
        input: featurePermissions,
        actor: effectiveActor
      });
    } else {
      await seedDefaultUserFeaturePermissions(
        user.id,
        companyId,
        profile,
        planMap,
        { actorUserId: actor?.id ?? null }
      );
    }
  }

  const serializedUser = await SerializeUser(user, {
    effectiveCompanyIdForPlan: companyId ?? null
  });

  return serializedUser;
};

export default CreateUserService;
