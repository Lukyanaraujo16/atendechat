import AppError from "../errors/AppError";

const BRAZIL_UF_SET = new Set([
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
]);

function trimOrNull(value: unknown, maxLen: number): string | null {
  if (value === null) return null;
  const t = String(value).trim();
  if (!t) return null;
  if (t.length > maxLen) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Campo de endereço excede o tamanho máximo."
    );
  }
  return t;
}

export type ContactAddressFields = {
  postalCode?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

/**
 * Extrai campos opcionais de endereço estruturado do Contact.
 * Campos ausentes no payload não entram no patch (compatível com clientes antigos).
 */
export function pickContactAddressFields(
  raw: Record<string, unknown> | null | undefined
): ContactAddressFields {
  if (!raw) return {};
  const out: ContactAddressFields = {};

  if ("postalCode" in raw) {
    out.postalCode = trimOrNull(raw.postalCode, 20);
  }
  if ("street" in raw) {
    out.street = trimOrNull(raw.street, 255);
  }
  if ("addressNumber" in raw) {
    out.addressNumber = trimOrNull(raw.addressNumber, 30);
  }
  if ("addressComplement" in raw) {
    out.addressComplement = trimOrNull(raw.addressComplement, 120);
  }
  if ("district" in raw) {
    out.district = trimOrNull(raw.district, 120);
  }
  if ("city" in raw) {
    out.city = trimOrNull(raw.city, 120);
  }
  if ("state" in raw) {
    const state = trimOrNull(raw.state, 2);
    if (state == null) {
      out.state = null;
    } else {
      const uf = state.toUpperCase();
      if (!BRAZIL_UF_SET.has(uf)) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "UF inválida. Use sigla brasileira de 2 letras."
        );
      }
      out.state = uf;
    }
  }

  return out;
}

export const CONTACT_ADDRESS_ATTRIBUTE_NAMES = [
  "postalCode",
  "street",
  "addressNumber",
  "addressComplement",
  "district",
  "city",
  "state"
] as const;
