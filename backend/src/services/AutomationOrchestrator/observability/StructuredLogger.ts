import { logger } from "../../../utils/logger";
import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";
import { getObservabilityConfig } from "./ObservabilityConfig";

/**
 * Logging estruturado JSON — nunca texto livre sem campos.
 */
export function agentOsLog(
  level: "debug" | "info" | "warn" | "error",
  fields: Record<string, unknown>
): void {
  if (!getObservabilityConfig().enabled) return;
  const payload = sanitizeAutomationPayload({
    ...fields,
    channel: "agentos",
    ts: new Date().toISOString()
  });
  const line = { msg: "agentos_observability", ...payload };
  if (level === "error") logger.error(line);
  else if (level === "warn") logger.warn(line);
  else logger.info(line);
}

export default agentOsLog;
