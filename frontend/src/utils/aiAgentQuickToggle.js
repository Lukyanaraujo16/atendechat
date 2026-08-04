/**
 * Toggle rápido no card do Hub (Fase 2.19 / 2.19.1).
 * Controla enabled/disabled via commands Product; não é seletor de modo.
 * Autoridade do último modo: backend (aiAgentMode preservado nas conexões).
 */
import { i18n } from "../translate/i18n";

const ACTIVATE_COMMANDS = new Set(["activate_shadow", "activate_live"]);

/**
 * Resolve o command de ativação a partir do modo persistido no Product.
 *
 * - live → activate_live
 * - shadow → activate_shadow
 * - off/ausente → null (exige escolha explícita; sem fallback Shadow silencioso)
 *
 * @param {{ operationMode?: string } | null | undefined} agent
 * @returns {"activate_shadow"|"activate_live"|null}
 */
export function resolveAiAgentQuickActivateCommand(agent) {
  const mode = String(agent?.operationMode || "off").toLowerCase();
  if (mode === "live") return "activate_live";
  if (mode === "shadow") return "activate_shadow";
  return null;
}

export function isAiAgentQuickActivateCommand(command) {
  return ACTIVATE_COMMANDS.has(String(command || ""));
}

/** Modo persistido recuperável para UI (mesmo com enabled=false). */
export function resolveAiAgentPersistedOperationMode(agent) {
  const mode = String(agent?.operationMode || "off").toLowerCase();
  if (mode === "live" || mode === "shadow") return mode;
  return null;
}

export function mapAiAgentProductCommandError(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  const status = err?.response?.status;
  if (status === 403 || code === "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED") {
    return i18n.t("aiAgentProduct.commandErrors.accessDenied");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE") {
    return i18n.t("aiAgentProduct.commandErrors.notAvailable");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_READY") {
    return i18n.t("aiAgentProduct.hub.quickToggle.notReadyBody");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE") {
    return i18n.t("aiAgentProduct.hub.quickToggle.connectionHint");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED") {
    return i18n.t("aiAgentProduct.commandErrors.notAllowed");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED") {
    return i18n.t("aiAgentProduct.commandErrors.agentRefRequired");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND") {
    return i18n.t("aiAgentProduct.hub.agentNotFoundDescription");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS") {
    return i18n.t("aiAgentProduct.commandErrors.ambiguous");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID") {
    return i18n.t("aiAgentProduct.commandErrors.contextInvalid");
  }
  return i18n.t("aiAgentProduct.commandErrors.generic");
}
