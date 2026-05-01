import AppError from "../errors/AppError";

/**
 * Mesma regra que o frontend `parseBrazilianCurrencyToNumber` (valores BR / mistos).
 */
export function parseBrazilianCurrencyToNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/\s+/g, "");
  s = s.replace(/R\$/gi, "");
  s = s.trim();
  s = s.replace(/[^0-9.,-]/g, "");

  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (!s) return null;

  if (s.includes(",")) {
    const last = s.lastIndexOf(",");
    const intRaw = s.slice(0, last).replace(/\./g, "");
    const fracRaw = s.slice(last + 1).replace(/\./g, "");
    if (!/^\d*$/.test(intRaw) || !/^\d*$/.test(fracRaw)) return null;
    s = fracRaw.length ? `${intRaw || "0"}.${fracRaw}` : intRaw || "0";
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      s = parts.join("");
    } else if (parts.length === 2) {
      const [a, b] = parts;
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return null;
      if (b.length <= 2 || a === "0") {
        s = `${a}.${b}`;
      } else if (b.length === 3) {
        s = a + b;
      } else {
        s = `${a}.${b}`;
      }
    }
  }

  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

/** Create: omisso ou vazio → 0 (comportamento anterior do formulário). */
export function normalizePlanValueForCreate(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = parseBrazilianCurrencyToNumber(raw);
  if (n === null || Number.isNaN(n)) {
    throw new AppError("ERR_PLAN_INVALID_VALUE", 400);
  }
  if (n < 0) {
    throw new AppError("ERR_PLAN_INVALID_VALUE", 400);
  }
  return n;
}

/** Update: `value` enviado não pode ser vazio. */
export function normalizePlanValueField(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") {
    throw new AppError("ERR_PLAN_VALUE_REQUIRED", 400);
  }
  const n = parseBrazilianCurrencyToNumber(raw);
  if (n === null || Number.isNaN(n)) {
    throw new AppError("ERR_PLAN_INVALID_VALUE", 400);
  }
  if (n < 0) {
    throw new AppError("ERR_PLAN_INVALID_VALUE", 400);
  }
  return n;
}

/** Só converte se a chave existir no objeto (update parcial). */
export function normalizePlanValueIfPresent(
  data: Record<string, unknown>
): void {
  if (!Object.prototype.hasOwnProperty.call(data, "value")) return;
  const v = normalizePlanValueField(data.value);
  data.value = v;
}

/**
 * Valor contratado por empresa: vazio → null (usa plano); 0 explícito é permitido.
 */
export function normalizeNullableContractedPlanValue(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseBrazilianCurrencyToNumber(raw);
  if (n === null || Number.isNaN(n)) {
    throw new AppError("ERR_CONTRACTED_PLAN_VALUE_INVALID", 400);
  }
  if (n < 0) {
    throw new AppError("ERR_CONTRACTED_PLAN_VALUE_INVALID", 400);
  }
  return n;
}

/** Limite de armazenamento em GB: vazio → null (ilimitado). Aceita formato BR no texto. */
export function normalizeNullableStorageLimitGb(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      throw new AppError("ERR_INVALID_STORAGE_LIMIT_GB", 400);
    }
    return raw;
  }
  const n = parseBrazilianCurrencyToNumber(raw);
  if (n === null || Number.isNaN(n)) {
    throw new AppError("ERR_INVALID_STORAGE_LIMIT_GB", 400);
  }
  if (n < 0) {
    throw new AppError("ERR_INVALID_STORAGE_LIMIT_GB", 400);
  }
  return n;
}
