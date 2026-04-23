import { Request, Response } from "express";
import RequestPasswordResetService from "../services/PasswordReset/RequestPasswordResetService";
import ConfirmPasswordResetService from "../services/PasswordReset/ConfirmPasswordResetService";

/** POST /auth/forgot-password { email } */
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const email = req.body?.email;
  await RequestPasswordResetService(String(email ?? ""));
  return res.status(200).json({
    ok: true,
    code: "RESET_EMAIL_SENT"
  });
};

/** POST /auth/reset-password { email, token, password } */
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, token, password } = req.body ?? {};
  await ConfirmPasswordResetService(
    String(email ?? ""),
    String(token ?? ""),
    String(password ?? "")
  );
  return res.status(200).json({
    ok: true,
    code: "PASSWORD_UPDATED"
  });
};
