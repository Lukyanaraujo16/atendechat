/**
 * Toggle rápido no card do Hub (Fase 2.19).
 * Controla enabled/disabled via commands Product; não é seletor de modo.
 */
import { i18n } from "../translate/i18n";

const ACTIVATE_COMMANDS = new Set(["activate_shadow", "activate_live"]);

/** Memória de sessão (SPA) do último modo ao desativar pelo toggle. Sem migration. */
const lastOperationModeByAgentRef = Object.create(null);

/**
 * Resolve o command de ativação sem inventar Live arbitrariamente.
 *
 * Ordem:
 * 1. preferredMode explícito;
 * 2. memória de sessão do card (após desativar no Hub);
 * 3. operationMode atual se ainda for live/shadow;
 * 4. regra oficial Product quando off: activate_shadow.
 *
 * @param {{ agentRef?: string, operationMode?: string } | null | undefined} agent
 * @param {"live"|"shadow"|null|undefined} [preferredMode]
 * @returns {"activate_shadow"|"activate_live"}
 */
export function resolveAiAgentQuickActivateCommand(agent, preferredMode) {
  const preferred = String(
    preferredMode || takeAiAgentLastOperationMode(agent?.agentRef) || ""
  ).toLowerCase();
  if (preferred === "live") return "activate_live";
  if (preferred === "shadow") return "activate_shadow";

  const mode = String(agent?.operationMode || "off").toLowerCase();
  if (mode === "live") return "activate_live";
  if (mode === "shadow") return "activate_shadow";
  return "activate_shadow";
}

export function isAiAgentQuickActivateCommand(command) {
  return ACTIVATE_COMMANDS.has(String(command || ""));
}

/**
 * Memória de sessão do último modo operacional ao desativar pelo toggle.
 * Não persiste no backend (sem migration); após full reload da página usa a regra Product.
 */
export function rememberAiAgentLastOperationMode(agentRef, mode) {
  const ref = String(agentRef || "").trim();
  if (!ref) return;
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "live" || normalized === "shadow") {
    lastOperationModeByAgentRef[ref] = normalized;
  }
}

export function takeAiAgentLastOperationMode(agentRef) {
  const ref = String(agentRef || "").trim();
  if (!ref) return null;
  const mode = lastOperationModeByAgentRef[ref];
  return mode === "live" || mode === "shadow" ? mode : null;
}

/** Apenas testes. */
export function __resetAiAgentQuickToggleSessionMemory() {
  Object.keys(lastOperationModeByAgentRef).forEach((key) => {
    delete lastOperationModeByAgentRef[key];
  });
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
