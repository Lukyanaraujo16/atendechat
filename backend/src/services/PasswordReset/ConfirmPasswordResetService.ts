import AppError from "../../errors/AppError";
import User from "../../models/User";
import {
  getFirstYupErrorMessage,
  strongPasswordSchema
} from "../../utils/passwordPolicy";
import MarkSignupRequestActivatedForUserService from "../CompanySignupRequest/MarkSignupRequestActivatedForUserService";

/**
 * Valida token + expiração, atualiza senha (hooks do modelo aplicam hash) e limpa token.
 */
const ConfirmPasswordResetService = async (
  emailRaw: string,
  tokenRaw: string,
  password: string
): Promise<void> => {
  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();
  const token = String(tokenRaw || "").trim();

  try {
    await strongPasswordSchema.validate(password);
  } catch (err: unknown) {
    throw new AppError(getFirstYupErrorMessage(err), 400);
  }

  if (!email || !token) {
    throw new AppError("ERR_RESET_INVALID", 400, "Dados inválidos.");
  }

  const user = await User.findOne({
    where: { email, resetPassword: token }
  });

  if (!user) {
    throw new AppError(
      "ERR_RESET_INVALID",
      400,
      "Código inválido ou e-mail incorreto."
    );
  }

  if (
    !user.passwordResetExpires ||
    new Date(user.passwordResetExpires).getTime() < Date.now()
  ) {
    throw new AppError(
      "ERR_RESET_EXPIRED",
      400,
      "Código expirado. Solicite nova recuperação de senha."
    );
  }

  user.password = password;
  user.resetPassword = null;
  user.passwordResetExpires = null;
  user.mustChangePassword = false;
  await user.save();

  await MarkSignupRequestActivatedForUserService(user, "password_reset");
};

export default ConfirmPasswordResetService;
