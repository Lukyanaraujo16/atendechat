/**
 * Product API client — Agente de IA (Fase 2.0).
 * Não chama /automation/* nem endpoints técnicos do Console.
 */
import api from "./api";

export function getAiAgentProductSummary() {
  return api.get("/product/ai-agent/summary");
}

export function getAiAgentProductReadiness() {
  return api.get("/product/ai-agent/readiness");
}
