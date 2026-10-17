import {
  isValidCep,
  isValidEmail,
  isValidPhone,
  isValidUf,
  validateDocument,
} from "../../../helpers/brMasks";

/** Aba onde cada campo do formulário é editado (para levar o utilizador ao erro). */
export const FIELD_TAB = {
  name: "cadastro",
  tradeName: "cadastro",
  legalName: "cadastro",
  document: "cadastro",
  email: "cadastro",
  phone: "cadastro",
  addressZipCode: "cadastro",
  addressStreet: "cadastro",
  addressNumber: "cadastro",
  addressComplement: "cadastro",
  addressNeighborhood: "cadastro",
  addressCity: "cadastro",
  addressState: "cadastro",
  planId: "plano",
  status: "plano",
  recurrence: "plano",
  dueDate: "plano",
  timezone: "plano",
  contractedPlanValueStr: "plano",
  storageLimitGbStr: "plano",
  businessSegment: "plano",
  crmVisibilityMode: "plano",
  modulePermissions: "funcionalidades",
};

/** Erros de validação do backend (contrato Fase 8.4) → campo + mensagem. */
export const BACKEND_FIELD_ERRORS = {
  ERR_INVALID_DOCUMENT: { field: "document", message: "CPF/CNPJ inválido." },
  ERR_INVALID_EMAIL: { field: "email", message: "E-mail inválido." },
  ERR_INVALID_PHONE: {
    field: "phone",
    message: "Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.",
  },
  ERR_INVALID_ZIPCODE: { field: "addressZipCode", message: "CEP inválido. Informe os 8 dígitos." },
  ERR_INVALID_STATE: { field: "addressState", message: "UF inválida." },
};

function same(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function diffChangedKeys(values, initialValues) {
  const v = values || {};
  const i = initialValues || {};
  return Object.keys(v).filter((k) => !same(v[k], i[k]));
}

const filled = (v) => String(v ?? "").trim() !== "";

/**
 * Validação no cliente. Campos de cadastro só são validados quando foram alterados,
 * para que cadastros antigos incompletos/legados continuem salváveis.
 */
export function validateCompanyForm(values, initialValues) {
  const errors = {};
  const changed = (k) => !same(values[k], (initialValues || {})[k]);

  if (!filled(values.name)) errors.name = "Informe o nome da empresa.";

  if (changed("email")) {
    if (!filled(values.email)) errors.email = "Informe o e-mail principal da empresa.";
    else if (!isValidEmail(values.email)) errors.email = "E-mail inválido.";
  }
  if (changed("phone") && filled(values.phone) && !isValidPhone(values.phone)) {
    errors.phone = "Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.";
  }
  if (changed("document") && filled(values.document)) {
    const doc = validateDocument(values.document);
    if (!doc.type) errors.document = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
    else if (!doc.valid) errors.document = doc.type === "cpf" ? "CPF inválido." : "CNPJ inválido.";
  }
  if (changed("addressZipCode") && filled(values.addressZipCode) && !isValidCep(values.addressZipCode)) {
    errors.addressZipCode = "CEP inválido. Informe os 8 dígitos.";
  }
  if (changed("addressState") && filled(values.addressState) && !isValidUf(values.addressState)) {
    errors.addressState = "UF inválida.";
  }
  return errors;
}
