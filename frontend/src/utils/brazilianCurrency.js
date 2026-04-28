/**
 * Converte texto de valor em formato brasileiro (e variações) para número.
 * Aceita: 99,90 | 99.90 | 99,9 | R$ 1.299,90 | 1299,90 | etc.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseBrazilianCurrencyToNumber(raw) {
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

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Ex.: R$ 1.299,90
 * @param {unknown} value
 * @returns {string}
 */
export function formatCurrencyBRL(value) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) {
    return brlFormatter.format(0);
  }
  return brlFormatter.format(n);
}

/**
 * Número para o campo de formulário (sem símbolo R$, vírgula decimal, milhar com ponto).
 * @param {unknown} value
 * @returns {string}
 */
export function formatPlanValueForInput(value) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) {
    return "";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
