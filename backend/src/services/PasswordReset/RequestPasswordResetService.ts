import { randomBytes } from "crypto";
import User from "../../models/User";
import sendPasswordResetEmail from "./sendPasswordResetEmail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Gera token, grava expiração e envia e-mail.
 * Não revela se o e-mail existe (chamar sempre com resposta genérica ao cliente).
 */
const RequestPasswordResetService = async (emailRaw: string): Promise<void> => {
  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return;
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  user.resetPassword = token;
  user.passwordResetExpires = new Date(Date.now() + TOKEN_TTL_MS);
  await user.save();

  try {
    await sendPasswordResetEmail({
      to: email,
      token,
      userName: user.name || ""
    });
  } catch (err) {
    console.error("[PasswordReset] Falha ao enviar e-mail:", err);
  }
};

export default RequestPasswordResetService;
