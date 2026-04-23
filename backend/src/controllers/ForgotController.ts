import { Request, Response } from "express";
import RequestPasswordResetService from "../services/PasswordReset/RequestPasswordResetService";
import ConfirmPasswordResetService from "../services/PasswordReset/ConfirmPasswordResetService";

/** @deprecated Prefer POST /auth/forgot-password com body JSON */
export const store = async (req: Request, res: Response): Promise<Response> => {
  const email = decodeURIComponent(String(req.params.email || ""));
  await RequestPasswordResetService(email);
  return res.status(200).json({ ok: true, code: "RESET_EMAIL_SENT" });
};

/** @deprecated Prefer POST /auth/reset-password — evita senha na URL */
export const resetPasswords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const email = decodeURIComponent(String(req.params.email || ""));
  const token = decodeURIComponent(String(req.params.token || ""));
  const password = decodeURIComponent(String(req.params.password || ""));
  await ConfirmPasswordResetService(email, token, password);
  return res.status(200).json({ ok: true, code: "PASSWORD_UPDATED" });
};
