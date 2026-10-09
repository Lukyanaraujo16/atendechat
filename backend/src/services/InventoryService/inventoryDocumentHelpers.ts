import AppError from "../../errors/AppError";

/** Normaliza CPF/CNPJ para somente dígitos. */
export function normalizeDocumentDigits(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || allSameDigits(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  return mod === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || allSameDigits(digits)) return false;
  const calc = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += Number(base[i]) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 12) + String(d1), w2);
  return digits.endsWith(`${d1}${d2}`);
}

export function validateAndNormalizeDocument(
  value: unknown,
  customerType?: "individual" | "company"
): string | null {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return null;

  if (digits.length === 11) {
    if (customerType === "company") {
      throw new AppError(
        "ERR_INVENTORY_CUSTOMER_DOCUMENT_TYPE",
        400,
        "CPF não é válido para cliente PJ."
      );
    }
    if (!isValidCpf(digits)) {
      throw new AppError(
        "ERR_INVENTORY_CUSTOMER_DOCUMENT_INVALID",
        400,
        "CPF inválido."
      );
    }
    return digits;
  }

  if (digits.length === 14) {
    if (customerType === "individual") {
      throw new AppError(
        "ERR_INVENTORY_CUSTOMER_DOCUMENT_TYPE",
        400,
        "CNPJ não é válido para cliente PF."
      );
    }
    if (!isValidCnpj(digits)) {
      throw new AppError(
        "ERR_INVENTORY_CUSTOMER_DOCUMENT_INVALID",
        400,
        "CNPJ inválido."
      );
    }
    return digits;
  }

  throw new AppError(
    "ERR_INVENTORY_CUSTOMER_DOCUMENT_INVALID",
    400,
    "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)."
  );
}

export function normalizePhoneDigits(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}
