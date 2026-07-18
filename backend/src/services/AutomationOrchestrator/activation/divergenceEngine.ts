import {
  AutomationDivergenceSeverity,
  AutomationIntent
} from "../../../config/automationOrchestratorConstants";

export type DivergenceResult = {
  matched: boolean;
  severity: AutomationDivergenceSeverity;
  reason: string;
};

const AI_INTENTS = new Set<AutomationIntent>(["live_agent", "knowledge"]);
const ROUTING_INTENTS = new Set<AutomationIntent>([
  "chatbot",
  "flow",
  "human",
  "integration"
]);

/**
 * Compara intent do planner vs decisão legada.
 * IA vs chatbot/flow = critical; knowledge vs handoff = warning; iguais = match.
 */
export function comparePlannerVsLegacy(
  plannedIntent: AutomationIntent | string | null | undefined,
  legacyIntent: AutomationIntent | string | null | undefined
): DivergenceResult {
  const planned = String(plannedIntent || "unknown") as AutomationIntent;
  const legacy = String(legacyIntent || "unknown") as AutomationIntent;

  if (planned === legacy) {
    return {
      matched: true,
      severity: "match",
      reason: "intents_match"
    };
  }

  if (
    (AI_INTENTS.has(planned) && legacy === "chatbot") ||
    (AI_INTENTS.has(legacy) && planned === "chatbot") ||
    (AI_INTENTS.has(planned) && legacy === "flow") ||
    (AI_INTENTS.has(legacy) && planned === "flow")
  ) {
    return {
      matched: false,
      severity: "critical",
      reason: `ia_vs_routing:${planned}_vs_${legacy}`
    };
  }

  if (
    (planned === "knowledge" && legacy === "human") ||
    (planned === "human" && legacy === "knowledge") ||
    (planned === "live_agent" && legacy === "human") ||
    (planned === "human" && legacy === "live_agent")
  ) {
    return {
      matched: false,
      severity: "warning",
      reason: `knowledge_vs_handoff:${planned}_vs_${legacy}`
    };
  }

  if (
    ROUTING_INTENTS.has(planned) &&
    ROUTING_INTENTS.has(legacy) &&
    planned !== legacy
  ) {
    return {
      matched: false,
      severity: "warning",
      reason: `routing_mismatch:${planned}_vs_${legacy}`
    };
  }

  if (planned === "unknown" || legacy === "unknown") {
    return {
      matched: false,
      severity: "info",
      reason: `unknown_side:${planned}_vs_${legacy}`
    };
  }

  return {
    matched: false,
    severity: "info",
    reason: `divergence:${planned}_vs_${legacy}`
  };
}

export default comparePlannerVsLegacy;
