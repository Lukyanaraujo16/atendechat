/**
 * Helpers ViaCEP reutilizáveis (Contact, Delivery, E3).
 * ViaCEP é auxílio de preenchimento — nunca autoritativo.
 */

export const VIACEP_TIMEOUT_MS = 4500;
export const CEP_LOOKUP_DEBOUNCE_MS = 300;

/** Somente dígitos, máx. 8. */
export function sanitizeCepDigits(raw) {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 8);
}

/** Exibição BR: XXXXX-XXX */
export function formatCepDisplay(raw) {
  const digits = sanitizeCepDigits(raw);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Mapeia resposta ViaCEP → endereço canônico compartilhado.
 * Não inclui número nem complemento particular.
 */
export function mapViaCepResponse(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  if (data.erro === true || data.erro === "true") {
    return null;
  }
  return {
    postalCode: formatCepDisplay(data.cep || ""),
    street: String(data.logradouro || "").trim(),
    district: String(data.bairro || "").trim(),
    city: String(data.localidade || "").trim(),
    state: String(data.uf || "")
      .trim()
      .toUpperCase()
      .slice(0, 2),
  };
}

/**
 * Mescla resultado do lookup sem sobrescrever número/complemento
 * e sem apagar campos manuais com strings vazias do ViaCEP.
 */
export function mergeCepLookupIntoAddress(
  current,
  lookupAddress,
  fieldMap = {}
) {
  const map = {
    postalCode: "postalCode",
    street: "street",
    district: "district",
    city: "city",
    state: "state",
    ...fieldMap,
  };
  const next = { ...(current || {}) };
  if (!lookupAddress) return next;

  const apply = (canonicalKey) => {
    const targetKey = map[canonicalKey];
    if (!targetKey) return;
    const value = lookupAddress[canonicalKey];
    if (value == null || String(value).trim() === "") return;
    next[targetKey] = String(value).trim();
  };

  apply("postalCode");
  apply("street");
  apply("district");
  apply("city");
  apply("state");
  return next;
}

/**
 * Consulta ViaCEP. `cepDigits` deve ter exatamente 8 dígitos.
 * Usa axios puro (sem auth) + timeout + signal.
 */
export async function fetchViaCep(cepDigits, options = {}) {
  const {
    timeoutMs = VIACEP_TIMEOUT_MS,
    signal,
    httpGet,
  } = options;
  const digits = sanitizeCepDigits(cepDigits);
  if (digits.length !== 8) {
    throw new Error("cep-invalid-length");
  }

  const url = `https://viacep.com.br/ws/${digits}/json/`;
  const get =
    httpGet ||
    (async (u, cfg) => {
      const axios = (await import("axios")).default;
      return axios.get(u, cfg);
    });

  const response = await get(url, {
    timeout: timeoutMs,
    signal,
    withCredentials: false,
    // Evita enviar cookies/auth do app a terceiros.
    headers: { Accept: "application/json" },
  });

  const data = response?.data;
  if (data && (data.erro === true || data.erro === "true")) {
    return { status: "not_found", address: null, raw: data };
  }
  const address = mapViaCepResponse(data);
  if (!address) {
    return { status: "invalid", address: null, raw: data };
  }
  return { status: "success", address, raw: data };
}
