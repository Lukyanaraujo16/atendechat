/** Máscara segura para exibição (nunca expõe a chave completa). */
export function maskSecret(plain: string | null | undefined): string {
  const s = String(plain || "").trim();
  if (!s) return "—";
  if (s.length <= 8) return "••••••••";
  const prefix = s.startsWith("sk-") ? "sk-" : s.slice(0, 3);
  const suffix = s.slice(-4);
  return `${prefix}••••${suffix}`;
}
