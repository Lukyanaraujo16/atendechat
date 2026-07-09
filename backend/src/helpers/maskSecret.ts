/** Máscara segura para exibição (nunca expõe a chave completa). */
export function maskSecret(plain: string | null | undefined): string {
  const s = String(plain || "").trim();
  if (!s) return "—";
  if (s.length <= 8) return "••••••••";
  if (s.startsWith("sk-")) {
    return `sk-••••${s.slice(-4)}`;
  }
  if (s.startsWith("AIza")) {
    return `AIza••••${s.slice(-4)}`;
  }
  const prefix = s.slice(0, 4);
  const suffix = s.slice(-4);
  return `${prefix}••••${suffix}`;
}
