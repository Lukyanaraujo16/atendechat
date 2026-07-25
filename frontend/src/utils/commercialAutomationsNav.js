/**
 * Paths comerciais do módulo Automações (Fase 1.2).
 * AgentOS / Agente de IA / KB / Prompts / Quick Replies ficam fora deste agrupamento.
 */
export function isCommercialAutomationsPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  return (
    pathname === "/flowbuilders" ||
    pathname.startsWith("/flowbuilder") ||
    pathname === "/phrase-lists" ||
    pathname === "/queue-integration"
  );
}
