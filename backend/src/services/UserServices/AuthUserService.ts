import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import MarkSignupRequestActivatedForUserService from "../CompanySignupRequest/MarkSignupRequestActivatedForUserService";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number | null;
}

interface Request {
  email: string;
  password: string;
}

/**
 * Campos de Company devolvidos no login a qualquer perfil da empresa: os que o frontend lê da
 * sessão. Fora: internalNotes/contractedPlanValue (só Super Admin), dados cadastrais e operacionais.
 */
export const LOGIN_COMPANY_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "status",
  "dueDate",
  "timezone",
  "businessSegment",
  "crmVisibilityMode",
  "unassignedTicketsQueueId",
  "modulePermissions"
];

/** O login só lê `campaignsEnabled`; as demais Settings guardam tokens de integração. */
export const LOGIN_COMPANY_SETTING_KEYS = ["campaignsEnabled"];

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const user = await User.findOne({
    where: { email },
    include: [
      "queues",
      {
        model: Company,
        attributes: LOGIN_COMPANY_ATTRIBUTES,
        include: [
          {
            model: Setting,
            attributes: ["key", "value"],
            where: { key: LOGIN_COMPANY_SETTING_KEYS },
            required: false
          }
        ]
      }
    ]
  });

  if (!user) {
    throw new AppError("ERR_USER_DONT_EXISTS", 401);
  }

  if (!(await user.checkPassword(password))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  if (user.active === false) {
    throw new AppError("ERR_USER_INACTIVE", 403);
  }

  await MarkSignupRequestActivatedForUserService(user, "login");

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
