/**
 * Máscaras e validações brasileiras (CPF/CNPJ, telefone, CEP, UF) sem dependências externas.
 * Também expõe a consulta ao ViaCEP com timeout.
 */

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function onlyDigits(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\D/g, "");
}

/* ---------------------------- CPF / CNPJ ---------------------------- */

export function maskCpf(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara automática: até 11 dígitos → CPF; acima → CNPJ. */
export function maskCpfCnpj(value) {
  const d = onlyDigits(value);
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d);
}

export function isValidCpf(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(d[i]) * (len + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(d[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/**
 * Identifica e valida um documento (CPF ou CNPJ).
 * @returns {{ type: "cpf"|"cnpj"|null, valid: boolean, digits: string }}
 */
export function validateDocument(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return { type: "cpf", valid: isValidCpf(digits), digits };
  if (digits.length === 14) return { type: "cnpj", valid: isValidCnpj(digits), digits };
  return { type: null, valid: false, digits };
}

/* ------------------------------ Telefone ----------------------------- */

/**
 * Telefone com DDD: (11) 2345-6789 ou (11) 91234-5678.
 * Números com DDI 55 (12–13 dígitos) são exibidos como +55 (11) 91234-5678.
 */
export function maskPhone(value) {
  let d = onlyDigits(value);
  let prefix = "";
  if (d.length > 11 && d.startsWith("55")) {
    prefix = "+55 ";
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (!d.length) return prefix.trim();
  if (d.length <= 2) return `${prefix}(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `${prefix}(${ddd}) ${rest}`;
  if (rest.length <= 8) return `${prefix}(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${prefix}(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Aceita 10/11 dígitos (DDD + número) ou 12/13 com DDI 55. DDD entre 11 e 99. */
export function isValidPhone(value) {
  let d = onlyDigits(value);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

/* -------------------------------- CEP -------------------------------- */

export function maskCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidCep(value) {
  const d = onlyDigits(value);
  return d.length === 8 && !/^0{8}$/.test(d);
}

export function isValidUf(value) {
  return BR_STATES.includes(String(value || "").trim().toUpperCase());
}

export function isValidEmail(value) {
  const s = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/* ------------------------------- ViaCEP ------------------------------ */

/**
 * Consulta https://viacep.com.br/ws/{cep}/json/.
 * Resolve { street, neighborhood, city, state, complement } ou lança Error com `code`:
 * INVALID_CEP | NOT_FOUND | TIMEOUT | NETWORK.
 */
export async function fetchViaCep(cep, { timeoutMs = 8000, fetchImpl } = {}) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) {
    const e = new Error("CEP inválido");
    e.code = "INVALID_CEP";
    throw e;
  }
  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!doFetch) {
    const e = new Error("Consulta de CEP indisponível");
    e.code = "NETWORK";
    throw e;
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (controller) controller.abort();
  }, timeoutMs);
  try {
    const res = await doFetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller ? controller.signal : undefined,
    });
    if (!res || !res.ok) {
      const e = new Error("Falha ao consultar o CEP");
      e.code = res && res.status === 400 ? "INVALID_CEP" : "NETWORK";
      throw e;
    }
    const data = await res.json();
    if (!data || data.erro) {
      const e = new Error("CEP não encontrado");
      e.code = "NOT_FOUND";
      throw e;
    }
    return {
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: (data.uf || "").toUpperCase(),
      complement: data.complemento || "",
    };
  } catch (err) {
    if (err && err.code) throw err;
    const e = new Error(timedOut ? "Tempo esgotado ao consultar o CEP" : "Falha ao consultar o CEP");
    e.code = timedOut ? "TIMEOUT" : "NETWORK";
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function viaCepErrorMessage(err) {
  switch (err && err.code) {
    case "INVALID_CEP":
      return "CEP inválido. Informe os 8 dígitos.";
    case "NOT_FOUND":
      return "CEP não encontrado. Preencha o endereço manualmente.";
    case "TIMEOUT":
      return "A consulta do CEP demorou demais. Tente novamente ou preencha manualmente.";
    default:
      return "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.";
  }
}
