import * as Yup from "yup";
import { randomBytes } from "crypto";

/** Alinhado ao fluxo de reset de senha (mín. 8, maiúscula, minúscula, número). */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

/**
 * Senha obrigatória (cadastro, novo utilizador, super admin, etc.).
 * Mensagens são códigos consumidos pelo frontend (`backendErrors.*`).
 */
export const strongPasswordSchema = Yup.string()
  .min(8, "ERR_PASSWORD_TOO_SHORT")
  .max(PASSWORD_MAX_LENGTH, "ERR_PASSWORD_TOO_LONG")
  .matches(PASSWORD_REGEX, "ERR_PASSWORD_POLICY");

export const requiredPasswordSchema = strongPasswordSchema.required(
  "ERR_PASSWORD_REQUIRED"
);

/**
 * Senha opcional (edição): vazio mantém a atual; se preenchida, aplica a mesma política.
 */
export const optionalPasswordSchema = Yup.string()
  .transform((v) => (v === undefined || v === null ? "" : String(v)))
  .test("optional-strong-password", "ERR_PASSWORD_POLICY", function (val) {
    const s = (val ?? "").trim();
    if (!s) return true;
    try {
      strongPasswordSchema.validateSync(s);
      return true;
    } catch (err: unknown) {
      const yErr = err as Yup.ValidationError;
      const code = yErr.errors?.[0] || "ERR_PASSWORD_POLICY";
      return this.createError({ message: code });
    }
  });

export function getFirstYupErrorMessage(err: unknown): string {
  const yErr = err as Yup.ValidationError;
  if (yErr?.errors?.length) return yErr.errors[0];
  if (typeof (err as Error)?.message === "string") return (err as Error).message;
  return "ERR_PASSWORD_POLICY";
}

/**
 * Senha provisória aleatória que cumpre {@link strongPasswordSchema} (admin criado pelo SaaS).
 */
export function generateTemporaryPassword(): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;
  const buf = randomBytes(24);
  let out = "";
  out += lower[buf[0] % lower.length];
  out += upper[buf[1] % upper.length];
  out += digits[buf[2] % digits.length];
  for (let i = 3; i < 16; i++) {
    out += all[buf[i] % all.length];
  }
  strongPasswordSchema.validateSync(out);
  return out;
}
