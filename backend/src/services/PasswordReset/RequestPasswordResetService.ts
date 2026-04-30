import { randomBytes } from "crypto";
import User from "../../models/User";
import Company from "../../models/Company";
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

  const user = await User.findOne({
    where: { email },
    include: [{ model: Company, required: false, attributes: ["name"] }]
  });
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  user.resetPassword = token;
  user.passwordResetExpires = new Date(Date.now() + TOKEN_TTL_MS);
  await user.save();

  const companyName =
    user.company && user.company.name != null
      ? String(user.company.name)
      : "";

  try {
    await sendPasswordResetEmail({
      to: email,
      token,
      userName: user.name || "",
      kind: "reset",
      companyName
    });
  } catch (err) {
    console.error("[PasswordReset] Falha ao enviar e-mail:", err);
  }
};

export default RequestPasswordResetService;
