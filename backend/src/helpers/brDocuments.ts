import AppError from "../errors/AppError";

/**
 * Validações de dados cadastrais brasileiros (CPF, CNPJ, CEP, telefone, UF, e-mail).
 * Funções puras — sem acesso a banco. Usadas no cadastro de empresas (Fase 8.4).
 */

/** Remove tudo que não for dígito. `null`/`undefined` viram string vazia. */
export function normalizeDigits(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D+/g, "");
}

function isRepeatedSequence(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: unknown): boolean {
  const cpf = normalizeDigits(value);
  if (cpf.length !== 11 || isRepeatedSequence(cpf)) return false;

  const calcDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d2 === Number(cpf[10]);
}

export function isValidCnpj(value: unknown): boolean {
  const cnpj = normalizeDigits(value);
  if (cnpj.length !== 14 || isRepeatedSequence(cnpj)) return false;

  const calcDigit = (base: string): number => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(cnpj.slice(0, 12));
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calcDigit(cnpj.slice(0, 13));
  return d2 === Number(cnpj[13]);
}

/** Validação pragmática de e-mail (local@dominio.tld, sem espaços). */
export function isValidEmail(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const email = String(value).trim();
  if (email.length < 6 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** Telefone BR: 10 (fixo) ou 11 (celular) dígitos, com DDD entre 11 e 99. */
export function isValidBrPhone(value: unknown): boolean {
  const phone = normalizeDigits(value);
  if (phone.length !== 10 && phone.length !== 11) return false;
  const ddd = Number(phone.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

export function isValidCep(value: unknown): boolean {
  const cep = normalizeDigits(value);
  return cep.length === 8 && !/^0{8}$/.test(cep);
}

export const BR_UFS: readonly string[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
];

export function isValidUf(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return BR_UFS.includes(String(value).trim().toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* Cadastro de empresa (Fase 8.4)                                              */
/* -------------------------------------------------------------------------- */

/** Campos de texto livre do cadastro e o tamanho máximo de cada um. */
export const COMPANY_REGISTRATION_TEXT_FIELDS: Record<string, number> = {
  tradeName: 255,
  legalName: 255,
  addressStreet: 255,
  addressNumber: 20,
  addressComplement: 255,
  addressNeighborhood: 255,
  addressCity: 255
};

const TEXT_FIELD_LABELS: Record<string, string> = {
  tradeName: "Nome fantasia",
  legalName: "Razão social",
  addressStreet: "Logradouro",
  addressNumber: "Número",
  addressComplement: "Complemento",
  addressNeighborhood: "Bairro",
  addressCity: "Cidade"
};

export const COMPANY_REGISTRATION_FIELDS: readonly string[] = [
  ...Object.keys(COMPANY_REGISTRATION_TEXT_FIELDS),
  "document",
  "documentType",
  "addressZipCode",
  "addressState"
];

function has(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/**
 * Telefone da empresa: aceita 10–11 dígitos (DDD + número) ou o mesmo número
 * precedido do DDI 55 (12–13 dígitos), formato já usado no envio de avisos por WhatsApp.
 */
export function isValidCompanyPhone(value: unknown): boolean {
  const digits = normalizeDigits(value);
  if (isValidBrPhone(digits)) return true;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return isValidBrPhone(digits.slice(2));
  }
  return false;
}

export interface NormalizeCompanyRegistrationOptions {
  /** Valores atuais da empresa (edição). Telefone/e-mail legados inalterados não são revalidados. */
  current?: { phone?: unknown; email?: unknown } | null;
  /** Quando true, normaliza/valida também `phone` e `email`. */
  includeContact?: boolean;
}

/**
 * Normaliza e valida os campos cadastrais presentes em `input`.
 * — Só processa chaves presentes (ausente = não alterar).
 * — String vazia vira `null`; validação apenas quando preenchido.
 * — `documentType` é sempre derivado do tamanho do documento (11 = cpf, 14 = cnpj).
 * Lança AppError 400 com código (`ERR_INVALID_*`) e mensagem pt-BR legível.
 */
export function normalizeCompanyRegistrationInput(
  input: Record<string, unknown>,
  opts: NormalizeCompanyRegistrationOptions = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;

  for (const [field, max] of Object.entries(COMPANY_REGISTRATION_TEXT_FIELDS)) {
    if (!has(input, field)) continue;
    const raw = input[field];
    if (isBlank(raw)) {
      out[field] = null;
      continue;
    }
    const text = String(raw).trim().replace(/\s+/g, " ");
    if (text.length > max) {
      throw new AppError(
        "ERR_INVALID_FIELD",
        400,
        `${TEXT_FIELD_LABELS[field] || field} deve ter no máximo ${max} caracteres.`
      );
    }
    out[field] = text;
  }

  if (has(input, "document")) {
    const digits = normalizeDigits(input.document);
    if (!digits) {
      out.document = null;
      out.documentType = null;
    } else if (digits.length === 11) {
      if (!isValidCpf(digits)) {
        throw new AppError(
          "ERR_INVALID_DOCUMENT",
          400,
          "CPF inválido. Verifique os dígitos informados."
        );
      }
      out.document = digits;
      out.documentType = "cpf";
    } else if (digits.length === 14) {
      if (!isValidCnpj(digits)) {
        throw new AppError(
          "ERR_INVALID_DOCUMENT",
          400,
          "CNPJ inválido. Verifique os dígitos informados."
        );
      }
      out.document = digits;
      out.documentType = "cnpj";
    } else {
      throw new AppError(
        "ERR_INVALID_DOCUMENT",
        400,
        "Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)."
      );
    }
  }

  if (has(input, "addressZipCode")) {
    const digits = normalizeDigits(input.addressZipCode);
    if (!digits) {
      out.addressZipCode = null;
    } else if (!isValidCep(digits)) {
      throw new AppError(
        "ERR_INVALID_ZIPCODE",
        400,
        "CEP inválido. Informe 8 dígitos."
      );
    } else {
      out.addressZipCode = digits;
    }
  }

  if (has(input, "addressState")) {
    const raw = input.addressState;
    if (isBlank(raw)) {
      out.addressState = null;
    } else {
      const uf = String(raw).trim().toUpperCase();
      if (!isValidUf(uf)) {
        throw new AppError(
          "ERR_INVALID_STATE",
          400,
          "UF inválida. Informe a sigla do estado (ex.: SP)."
        );
      }
      out.addressState = uf;
    }
  }

  if (opts.includeContact) {
    if (has(input, "phone")) {
      const digits = normalizeDigits(input.phone);
      const currentDigits = normalizeDigits(opts.current?.phone);
      if (!digits) {
        out.phone = null;
      } else if (isValidCompanyPhone(digits)) {
        out.phone = digits;
      } else if (opts.current && digits === currentDigits) {
        // Valor legado inalterado: mantém como está (não bloqueia a edição de outros campos).
      } else {
        throw new AppError(
          "ERR_INVALID_PHONE",
          400,
          "Telefone inválido. Informe DDD + número (10 ou 11 dígitos)."
        );
      }
    }

    if (has(input, "email")) {
      const raw = input.email;
      const currentEmail = isBlank(opts.current?.email)
        ? ""
        : String(opts.current?.email).trim().toLowerCase();
      if (isBlank(raw)) {
        out.email = null;
      } else {
        const email = String(raw).trim().toLowerCase();
        if (isValidEmail(email)) {
          out.email = email;
        } else if (opts.current && email === currentEmail) {
          // E-mail legado inalterado: não revalida.
        } else {
          throw new AppError(
            "ERR_INVALID_EMAIL",
            400,
            "E-mail inválido. Verifique o endereço informado."
          );
        }
      }
    }
  }

  return out;
}
