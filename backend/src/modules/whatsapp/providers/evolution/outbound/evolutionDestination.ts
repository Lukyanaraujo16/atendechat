/**
 * Destino Evolution: body.number aceita telefone (dígitos) ou JID completo.
 * Domínio continua com remoteJid canônico; conversão só na borda.
 */
export function jidToEvolutionNumber(jid: string): string {
  const raw = String(jid || "").trim();
  if (!raw) {
    throw new Error("ERR_EVOLUTION_INVALID_DESTINATION");
  }
  if (
    raw.includes("@g.us") ||
    raw.includes("@s.whatsapp.net") ||
    raw.includes("@lid") ||
    raw.includes("@broadcast")
  ) {
    return raw;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    throw new Error("ERR_EVOLUTION_INVALID_DESTINATION");
  }
  return digits;
}
