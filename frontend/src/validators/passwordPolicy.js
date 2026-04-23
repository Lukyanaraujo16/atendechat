import * as Yup from "yup";

/** Mesma regra que o backend (`passwordPolicy.ts`) e o fluxo de reset. */
export const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

export const PASSWORD_MAX_LENGTH = 128;

/**
 * Senha obrigatória (ex.: cadastro, novo utilizador).
 * @param {string} policyMessage — texto único da regra (ex. i18n `passwordPolicy.requirements`)
 * @param {string} requiredMessage — quando o campo vem vazio
 */
export function yupPasswordRequired(policyMessage, requiredMessage) {
  return Yup.string()
    .required(requiredMessage)
    .min(8, policyMessage)
    .max(PASSWORD_MAX_LENGTH, policyMessage)
    .matches(PASSWORD_REGEX, policyMessage);
}

/**
 * Senha opcional (ex.: edição): em branco mantém a atual; se preenchida, aplica a política.
 */
export function yupPasswordOptional(policyMessage) {
  return Yup.string()
    .transform((v) => (v === undefined || v === null ? "" : String(v)))
    .test("password-policy-when-set", policyMessage, (val) => {
      const s = String(val || "").trim();
      if (!s) return true;
      if (s.length < 8 || s.length > PASSWORD_MAX_LENGTH) return false;
      return PASSWORD_REGEX.test(s);
    });
}

/** Validação imperativa (ex.: formulários sem Yup). */
export function passwordMeetsPolicy(plain) {
  const s = plain === undefined || plain === null ? "" : String(plain).trim();
  if (!s) return false;
  return (
    s.length >= 8 &&
    s.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_REGEX.test(s)
  );
}
