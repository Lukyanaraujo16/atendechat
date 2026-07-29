/**
 * Product API client — Agente de IA (Fases 2.0–2.2).
 * Não chama /automation/* nem endpoints técnicos do Console.
 * Mutações comerciais usam apenas POST /product/ai-agent/commands.
 */
import api from "./api";

export function getAiAgentProductSummary() {
  return api.get("/product/ai-agent/summary");
}

export function getAiAgentProductReadiness() {
  return api.get("/product/ai-agent/readiness");
}

/**
 * @param {"activate_shadow"|"activate_live"|"deactivate"} command
 */
export function postAiAgentProductCommand(command) {
  return api.post("/product/ai-agent/commands", { command });
}
