/**
 * Fallback estável quando o subject do grupo ainda não é conhecido.
 * Usa os dígitos do Contact.number (contrato atual), sem pushName/participante.
 *
 * "Grupo <digits>" continua placeholder para contactNeedsGroupNameResolution
 * (nameDigits === number), permitindo upgrade futuro para subject real.
 */
export function buildStableGroupContactFallbackName(
  groupNumberDigits: string
): string {
  const digits = String(groupNumberDigits || "").replace(/\D/g, "");
  return digits ? `Grupo ${digits}` : "Grupo";
}
